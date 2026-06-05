"""
GitHub Actions 전용 가격 스크래퍼 v2
에듀윌(Playwright JS렌더링) + 경쟁사(requests/Playwright) 통합
매일 KST 00:00 실행 → public/data/ JSON 자동 갱신

업데이트 대상:
  - course-X-comparison.json의 item.description (에듀윌 판매가)
  - course-X-comparison.json의 competitor_values 2번째 줄 (경쟁사 판매가)
  - price_config.json (경쟁사 가격 마스터)
"""
import json, os, re
from datetime import datetime, timezone, timedelta
import requests
from bs4 import BeautifulSoup
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

ROOT      = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR  = os.path.join(ROOT, "public", "data")
PRICE_CFG = os.path.join(DATA_DIR, "price_config.json")
KST       = timezone(timedelta(hours=9))

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
}

# ── Playwright 유틸 ───────────────────────────────────────────────────────────

def render_page(url, wait_until="networkidle", extra_wait=3000, timeout=40000):
    """Playwright로 JS 렌더링된 전체 HTML 반환"""
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as pw:
            browser = pw.chromium.launch(
                headless=True,
                args=["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
            )
            ctx = browser.new_context(
                user_agent=HEADERS["User-Agent"],
                locale="ko-KR",
                viewport={"width": 1280, "height": 900},
            )
            page = ctx.new_page()
            page.goto(url, wait_until=wait_until, timeout=timeout)
            if extra_wait:
                page.wait_for_timeout(extra_wait)
            html = page.content()
            browser.close()
            return html
    except Exception as e:
        print(f"    [Playwright] {url}: {e}")
        return None


def page_text(html):
    """HTML → 정제된 텍스트 (스크립트·스타일 제거)"""
    if not html:
        return ""
    soup = BeautifulSoup(html, "html.parser")
    for tag in soup(["script", "style", "noscript"]):
        tag.decompose()
    return soup.get_text(separator=" ", strip=True)


# ── 공통 가격 유틸 ────────────────────────────────────────────────────────────

def fetch(url, timeout=12):
    try:
        r = requests.get(
            url, headers=HEADERS, timeout=timeout, verify=False, allow_redirects=True
        )
        if r.status_code == 200:
            return r.text
    except Exception:
        pass
    return None


def _is_valid_price(n: int) -> bool:
    """실제 수강료로 유효한 가격인지 검증 (천원 단위 정수여야 함)"""
    return n % 1_000 == 0


def extract_prices(text, min_v=50_000, max_v=5_000_000):
    """텍스트 전체에서 가격 패턴 추출 → 빈도순 (천원 단위 정수만)"""
    if not text:
        return []
    nums = {}
    for m in re.finditer(r"(\d{1,3}(?:,\d{3})+)", text):
        n = int(m.group().replace(",", ""))
        if min_v <= n <= max_v and _is_valid_price(n):
            nums[n] = nums.get(n, 0) + 1
    return [f"{n:,}원" for n, _ in sorted(nums.items(), key=lambda x: -x[1])[:5]]


def first_price(html, min_v=50_000, max_v=5_000_000):
    prices = extract_prices(html or "", min_v, max_v)
    return prices[0] if prices else None


def find_price_near(text, keywords, min_v=100_000, max_v=5_000_000, window=500):
    """키워드 근처 window 글자 안에서 가장 자주 등장하는 유효 가격 반환"""
    if not text:
        return None
    for kw in keywords:
        idx = text.find(kw)
        if idx < 0:
            continue
        ctx = text[max(0, idx - window) : idx + window]
        nums = {}
        for m in re.finditer(r"(\d{1,3}(?:,\d{3})+)", ctx):
            n = int(m.group().replace(",", ""))
            if min_v <= n <= max_v and _is_valid_price(n):
                nums[n] = nums.get(n, 0) + 1
        if nums:
            best = max(nums.items(), key=lambda x: x[1])[0]
            return f"{best:,}원"
    return None


def find_price_with_original(text, keywords, min_v=100_000, max_v=5_000_000, window=600):
    """판매가 + 정가 형식으로 반환. 두 가격이 있고 10% 이상 차이나면 정가 표시."""
    if not text:
        return None
    for kw in keywords:
        idx = text.find(kw)
        if idx < 0:
            continue
        ctx = text[max(0, idx - window) : idx + window]
        found = []
        for m in re.finditer(r"(\d{1,3}(?:,\d{3})+)", ctx):
            n = int(m.group().replace(",", ""))
            if min_v <= n <= max_v and _is_valid_price(n):
                found.append(n)
        if not found:
            continue
        unique = sorted(set(found))
        if len(unique) >= 2 and unique[-1] > unique[0] * 1.1:
            sale, orig = unique[0], unique[-1]
            return f"{sale:,}원 (정가 {orig:,}원)"
        if unique:
            return f"{unique[0]:,}원"
    return None


# ── 에듀윌 과목별 상품 정의 ───────────────────────────────────────────────────
# (아이템명, [검색 키워드], 최소가격, 최대가격)

EDUWILL_COURSES = {
    "공인중개사": {
        "url": "https://land.eduwill.net/sites/home",
        "items": [
            ("AI+ VVIP 프리미엄 평생패스",
             ["AI+ VVIP", "VVIP 프리미엄", "VVIP"],
             1_500_000, 3_000_000),
            ("평생패스",
             ["평생패스"],
             800_000, 2_500_000),
            ("26+27 합격패스",
             ["26+27 합격패스", "합격패스"],
             800_000, 2_000_000),
        ],
    },
    "주택관리사": {
        "url": "https://house.eduwill.net/sites/home",
        "items": [
            ("100%환급 평생패스",
             ["100%환급 평생패스", "환급 평생패스"],
             1_000_000, 2_500_000),
            ("평생패스",
             ["평생패스"],
             800_000, 2_000_000),
            ("2027 연간합격패스",
             ["연간합격패스", "2027 연간"],
             600_000, 1_800_000),
        ],
    },
    "행정사": {
        "url": "https://admin.eduwill.net/sites/home",
        "items": [
            ("평생패스 (1+2차)",
             ["평생패스"],
             500_000, 1_500_000),
            ("2026+2027 0원 합격패스",
             ["0원 합격패스", "0원합격패스"],
             400_000, 1_200_000),
            ("2026+2027 합격완성패스",
             ["합격완성패스", "완성패스"],
             300_000, 1_000_000),
        ],
    },
    "사회복지사1급": {
        "url": "https://well.eduwill.net/sites/home",
        "items": [
            ("2027 장학금 드림패스",
             ["장학금 드림패스", "드림패스"],
             300_000, 900_000),
            ("2027+2028 장학금 드림패스 플러스",
             ["드림패스 플러스"],
             400_000, 1_000_000),
        ],
    },
    "검정고시": {
        "url": "https://black.eduwill.net/sites/home",
        "items": [
            ("고득점 패스",
             ["고득점 패스", "고득점패스"],
             300_000, 900_000),
            ("중/고졸 평생수강 합격패스",
             ["평생수강 합격패스", "중/고졸 평생"],
             400_000, 1_200_000),
            ("26년 2회 대비 고졸 장학금 패스",
             ["고졸 장학금 패스", "고졸 장학금"],
             200_000, 700_000),
            ("26년 2회 대비 중졸 장학금 패스",
             ["중졸 장학금 패스", "중졸 장학금"],
             100_000, 600_000),
        ],
    },
    "경비지도사": {
        "url": "https://guard.eduwill.net/sites/home",
        "items": [
            ("100% 환급 평생패스 1+2차",
             ["100% 환급 평생패스", "환급 평생패스"],
             300_000, 900_000),
            ("2년 보장 합격패스 1+2차",
             ["2년 보장 합격패스", "2년보장 합격패스"],
             200_000, 700_000),
        ],
    },
    "전기기사": {
        "url": "https://elec.eduwill.net/sites/home",
        "items": [
            ("전기(산업)기사 2년패스",
             ["전기(산업)기사 2년패스", "전기 2년패스"],
             300_000, 900_000),
            ("전기+공사 평생패스",
             ["전기+공사 평생패스", "전기 공사 평생"],
             200_000, 700_000),
            ("전기+소방 평생패스",
             ["전기+소방 평생패스", "전기 소방 평생"],
             300_000, 900_000),
        ],
    },
    "소방설비기사": {
        "url": "https://fire.eduwill.net/sites/home",
        "items": [
            ("쌍기사 평생패스",
             ["쌍기사 평생패스"],
             300_000, 800_000),
            ("쌍기사 2년패스",
             ["쌍기사 2년패스"],
             200_000, 750_000),
            ("소방+전기 평생패스",
             ["소방+전기 평생패스", "소방 전기 평생"],
             300_000, 900_000),
        ],
    },
    "9급공무원": {
        "url": "https://gov.eduwill.net/sites/home",
        "items": [
            ("9급 행정직 전직렬 평생 합격성공패스",
             ["전직렬 평생 합격성공패스", "평생 합격성공패스"],
             500_000, 2_000_000),
            ("9급 행정직 전직렬 27년 대비 합격성공패스",
             ["27년 대비 합격성공패스", "27년 합격성공패스"],
             400_000, 1_600_000),
            ("9급 직렬별패스",
             ["직렬별패스", "직렬별 패스"],
             200_000, 800_000),
        ],
    },
    "계리직공무원": {
        "url": "https://cop.eduwill.net/sites/home",
        "items": [
            ("[100%환급] 평생 올케어패스",
             ["평생 올케어패스", "올케어패스"],
             200_000, 800_000),
            ("[100%환급] 24개월 올케어패스",
             ["24개월 올케어패스", "24개월"],
             100_000, 600_000),
        ],
    },
    "손해평가사": {
        "url": "https://invest.eduwill.net/sites/home",
        "items": [
            ("2년보장 무한패스(1+2차)",
             ["2년보장 무한패스", "무한패스"],
             300_000, 800_000),
            ("100%환급 무한패스(1+2차)",
             ["100%환급 무한패스", "환급 무한패스"],
             200_000, 700_000),
        ],
    },
}


# ── 에듀윌 스크래퍼 ───────────────────────────────────────────────────────────

def scrape_eduwill_course(course_name, info):
    """Playwright로 에듀윌 과목 홈 렌더링 → 아이템별 판매가 추출"""
    print(f"  [{course_name}] {info['url']}")
    html = render_page(info["url"], wait_until="networkidle", extra_wait=3000)
    text = page_text(html)

    results = {}
    for item_name, keywords, min_v, max_v in info["items"]:
        price = find_price_with_original(text, keywords, min_v, max_v)
        results[item_name] = price
        print(f"    {item_name[:35]:<35}: {price or '찾지 못함'}")
    return results


# ── 경쟁사 스크래퍼 (requests) ────────────────────────────────────────────────

SCRAPERS = {}

def scraper(competitor):
    def decorator(fn):
        SCRAPERS[competitor] = fn
        return fn
    return decorator


@scraper("메가랜드")
def scrape_megaland():
    html = fetch("https://www.megaland.co.kr/lecture/")
    prices = extract_prices(html or "", 300_000, 2_000_000)
    return {"26+27 합격무적 1타PASS": prices[0] if prices else None}


@scraper("다산에듀")
def scrape_dasan():
    results = {}
    urls = {
        "속전속결 전기기사 종합 패키지":
            "https://www.e-dasan.net/shopItem?gcode=UGLMVEZ&gcd=2025&cate=662",
        "속전속결 전기공사기사 종합 패키지":
            "https://www.e-dasan.net/shopItem?gcode=WDIOWBO1&gcd=1154&cate=662",
    }
    for name, url in urls.items():
        html = fetch(url)
        results[name] = first_price(html, 100_000, 1_500_000)
    return results


@scraper("모아바")
def scrape_moaba():
    html = fetch("https://fireegfp.moa-ba.com/lecture.php?code=010301&menu_code=0107")
    prices = extract_prices(html or "", 200_000, 1_500_000)
    return {"쌍기사 올인원 패스": prices[0] if prices else None}


@scraper("에듀야")
def scrape_eduya():
    html = fetch("https://www.eduyaa.com/product/class_apply/package/2/")
    if not html:
        html = fetch("https://sh.eduyaa.com/main/")
    prices = extract_prices(html or "", 300_000, 2_000_000)
    return {
        "1,2차 골드평생합격반":  prices[0] if prices else None,
        "골드vip 1,2차 합격반": prices[1] if len(prices) > 1 else None,
    }


@scraper("계리단기")
def scrape_kaeri_danki():
    html = fetch("https://tech.conects.com/freepass/post")
    prices = extract_prices(html or "", 100_000, 1_000_000)
    return {
        "계리직 평생 프리패스 환급형":  prices[0] if prices else None,
        "계리직 27대비 환급 프리패스": prices[1] if len(prices) > 1 else None,
    }


@scraper("유상통")
def scrape_yusangtong():
    html  = fetch("https://eduon.com/yst/Contents/be_happy")
    html2 = fetch("https://eduon.com/yst/contents/dont_worry")
    return {
        "비해피패스": first_price(html,  100_000, 1_000_000),
        "돈워리패스": first_price(html2, 100_000, 1_000_000),
    }


@scraper("지안에듀")
def scrape_jianedu():
    for url in ["https://zianedu.com/", "https://www.zianedu.com/"]:
        html = fetch(url)
        if html:
            return {"2027 계리직 730 지안패스": first_price(html, 100_000, 1_000_000)}
    return {}


@scraper("공단기")
def scrape_gongdangi():
    html = fetch("https://gong.conects.com/freepass/renewal/9th")
    prices = extract_prices(html or "", 300_000, 3_000_000)
    return {
        "28대비 9급 프리미엄 환급 프리패스": prices[0] if prices else None,
        "전직렬 mini(비환급형)":             prices[-1] if len(prices) > 1 else None,
    }


@scraper("박문각")
def scrape_pmg():
    result = {}
    pages = [
        ("https://www.pmg.co.kr/user/plo/event/event_allpass.asp", 200_000, 3_000_000,
         ["2026 기출 평생회원", "2026 평생회원", "2026 올패스 플러스"]),
        ("https://www.pmg.co.kr/user/pho/main.asp", 200_000, 2_500_000,
         ["평생회원 100% 환급반", "평생회원", "26년+27년 필 합격반 플러스"]),
        ("https://www.pmg.co.kr/user/phjo/main.asp", 100_000, 1_500_000,
         ["2026 동차 올패스"]),
        ("https://www.pmg.co.kr/user/human/main.asp", 100_000, 1_000_000,
         ["휴먼 합격패스(교재미포함)", "휴먼 합격패스(교재포함)"]),
        ("https://www.pmg.co.kr/user/pno/event/event_allpass.asp", 200_000, 2_000_000,
         ["28대비 스파르타 환급 올패스", "7대비 스파르타 환급 올패스"]),
        ("https://www.pmg.co.kr/user/spo/main.asp", 100_000, 1_500_000,
         ["26-27 올패스 플러스"]),
    ]
    for url, mn, mx, names in pages:
        html = fetch(url)
        prices = extract_prices(html or "", mn, mx)
        for i, name in enumerate(names):
            result[name] = prices[i] if i < len(prices) else None
    return result


@scraper("시대에듀")
def scrape_sdedu():
    html = fetch("https://www.sdedu.co.kr/cp/?cat_id=001002")
    prices = extract_prices(html or "", 100_000, 1_000_000)
    return {
        "2년 보장 1+2차 환급 패스": prices[0] if prices else None,
        "1+2차 합격 패스":          prices[1] if len(prices) > 1 else None,
    }


@scraper("해커스")
def scrape_hackers():
    result = {}
    pages = [
        ("https://land.hackers.com/", 500_000, 3_000_000,
         ["평생환급 평생수강반", "평생보장반", "2026+2027 2년합격반"]),
        ("https://house.hackers.com/", 300_000, 2_500_000,
         ["100% 환급평생반", "평생보장 프리미엄"]),
        ("https://sabok.edu2080.co.kr/", 100_000, 1_000_000,
         ["장학금반", "합격보장반(기본연장반)"]),
        ("https://gumjung.edu2080.co.kr/", 100_000, 1_000_000,
         ["고졸 검정고시 무제한 연장반", "검정고시 환급반"]),
        ("https://egosi.hackers.com/site/?c=lec_9", 200_000, 3_000_000,
         ["9급 행정직 전직렬 합불 0원 패스 2028", "7대비 스파르타 환급 올패스",
          "9급 직렬별 합불 0원 패스"]),
        ("https://post.hackers.com/", 100_000, 1_000_000,
         ["2027 계리직 기적의 패스"]),
    ]
    for url, mn, mx, names in pages:
        html = fetch(url)
        prices = extract_prices(html or "", mn, mx)
        for i, name in enumerate(names):
            result[name] = prices[i] if i < len(prices) else None
    return result


# ── price_config.json 업데이트 ────────────────────────────────────────────────

def update_price_config(scraped: dict) -> dict:
    if os.path.exists(PRICE_CFG):
        with open(PRICE_CFG, encoding="utf-8") as f:
            config = json.load(f)
    else:
        config = {"prices": {}}

    prices = config.get("prices", {})
    updated = 0
    for competitor, products in scraped.items():
        if competitor not in prices:
            prices[competitor] = {}
        for product, price in (products or {}).items():
            if price and price != "가격 문의":
                old = prices[competitor].get(product, "가격 문의")
                if old != price:
                    print(f"  [{competitor}] {product}: {old} → {price}")
                    updated += 1
                prices[competitor][product] = price

    config["prices"] = prices
    config["last_updated"] = datetime.now(KST).strftime("%Y-%m-%dT%H:%M:%S")
    config["note"] = "매일 00:00 KST GitHub Actions 자동 업데이트"
    with open(PRICE_CFG, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    print(f"  price_config.json: {updated}건 변경")
    return prices


# ── 경쟁사 comparison.json 2번째 줄(가격) 업데이트 ────────────────────────────

def _inject_price(text: str, price: str) -> str:
    lines = text.split("\n")
    if len(lines) < 2:
        return text
    lines[1] = price
    return "\n".join(lines)


def update_comparison_competitors(prices: dict):
    changed = []
    for fname in sorted(os.listdir(DATA_DIR)):
        if not (fname.startswith("course-") and fname.endswith("-comparison.json")):
            continue
        fpath = os.path.join(DATA_DIR, fname)
        data = json.load(open(fpath, encoding="utf-8"))
        id2name = {str(c["id"]): c["name"] for c in data.get("competitors", [])}
        modified = False

        for item in data.get("items", []):
            for cid, val in item.get("competitor_values", {}).items():
                cname = id2name.get(cid)
                if not cname:
                    continue
                lines = val.split("\n")
                if not lines:
                    continue
                product_name = lines[0]
                new_price = prices.get(cname, {}).get(product_name)
                if new_price and new_price != "가격 문의" and len(lines) >= 2:
                    new_val = _inject_price(val, new_price)
                    if new_val != val:
                        item["competitor_values"][cid] = new_val
                        modified = True

        if modified:
            json.dump(data, open(fpath, "w", encoding="utf-8"),
                      ensure_ascii=False, indent=2)
            changed.append(fname)
            print(f"  ✅ {fname} 경쟁사 가격 업데이트")
    return changed


# ── 에듀윌 description(판매가) 업데이트 ──────────────────────────────────────

def update_eduwill_descriptions(eduwill_results: dict):
    """course-X-comparison.json의 item.description 갱신 (에듀윌 판매가)"""
    course_map = {}
    for fname in sorted(os.listdir(DATA_DIR)):
        if not (fname.startswith("course-") and fname.endswith("-comparison.json")):
            continue
        fpath = os.path.join(DATA_DIR, fname)
        data = json.load(open(fpath, encoding="utf-8"))
        course_map[data["course"]["name"]] = (fpath, data)

    changed = []
    for course_name, item_prices in eduwill_results.items():
        if course_name not in course_map:
            continue
        fpath, data = course_map[course_name]
        modified = False

        for item in data.get("items", []):
            new_price = item_prices.get(item["name"])
            if not new_price:
                continue
            old = item.get("description", "")
            if old != new_price:
                print(f"  [에듀윌/{course_name}] {item['name']}: {old} → {new_price}")
                item["description"] = new_price
                modified = True

        if modified:
            json.dump(data, open(fpath, "w", encoding="utf-8"),
                      ensure_ascii=False, indent=2)
            changed.append(os.path.basename(fpath))
            print(f"  ✅ {os.path.basename(fpath)} 에듀윌 가격 업데이트")
    return changed


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    now_str = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    print(f"\n{'='*65}")
    print(f"[CI Price Update v2] {now_str}")
    print(f"{'='*65}\n")

    # 1. 에듀윌 가격 (Playwright)
    print("▶ 에듀윌 과목별 판매가 스크래핑 (Playwright headless)\n")
    all_eduwill: dict = {}
    ew_ok, ew_fail = 0, 0
    for course_name, info in EDUWILL_COURSES.items():
        try:
            result = scrape_eduwill_course(course_name, info)
            all_eduwill[course_name] = result
            confirmed = sum(1 for v in result.values() if v)
            ew_ok += confirmed
            print(f"  → {confirmed}/{len(result)}건 확인\n")
        except Exception as e:
            print(f"  오류: {e}\n")
            ew_fail += 1

    print(f"에듀윌: 총 {ew_ok}건 확인, {ew_fail}개 과목 오류\n")

    # 2. 경쟁사 가격 (requests)
    print("▶ 경쟁사 판매가 스크래핑 (requests)\n")
    all_scraped: dict = {}
    ok, fail = 0, 0
    for name, fn in SCRAPERS.items():
        try:
            result = fn() or {}
            all_scraped[name] = result
            confirmed = sum(1 for v in result.values() if v and v != "가격 문의")
            print(f"  {name}: {confirmed}/{len(result)}건 확인")
            ok += confirmed
        except Exception as e:
            print(f"  {name}: 오류 — {e}")
            fail += 1

    print(f"\n경쟁사: 총 {ok}건 확인, {fail}개 사이트 오류\n")

    # 3. price_config.json 갱신
    print("▶ price_config.json 업데이트\n")
    prices = update_price_config(all_scraped)

    # 4. 경쟁사 comparison.json 갱신
    print("\n▶ 경쟁사 comparison.json 업데이트\n")
    comp_changed = update_comparison_competitors(prices)
    if not comp_changed:
        print("  경쟁사 가격 변동 없음")

    # 5. 에듀윌 comparison.json description 갱신
    print("\n▶ 에듀윌 comparison.json 판매가 업데이트\n")
    ew_changed = update_eduwill_descriptions(all_eduwill)
    if not ew_changed:
        print("  에듀윌 가격 변동 없음")

    all_changed = comp_changed + ew_changed
    print(f"\n✅ 완료 — {now_str}")
    if all_changed:
        print(f"변경된 파일: {all_changed}")
    else:
        print("변경 없음 (가격 동일)")


if __name__ == "__main__":
    main()
