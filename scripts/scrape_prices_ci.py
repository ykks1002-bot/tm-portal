"""
GitHub Actions 전용 가격 스크래퍼 (requests + BeautifulSoup, Selenium 불필요)
매일 KST 00:00 자동 실행 → public/data/price_config.json 갱신 → course-X-comparison.json 업데이트
"""
import json, os, re, sys
from datetime import datetime, timezone, timedelta
import requests
from bs4 import BeautifulSoup
import urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# frontend/ 가 repo root이므로 scripts/../ = repo root = frontend/
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR    = os.path.join(ROOT, "public", "data")
PRICE_CFG   = os.path.join(DATA_DIR, "price_config.json")
KST         = timezone(timedelta(hours=9))

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}

# ── 유틸 ──────────────────────────────────────────────────────────────────────

def fetch(url, timeout=12):
    try:
        r = requests.get(url, headers=HEADERS, timeout=timeout, verify=False, allow_redirects=True)
        if r.status_code == 200:
            return r.text
    except Exception:
        pass
    return None


def extract_prices(text, min_v=50_000, max_v=5_000_000):
    """텍스트에서 가격 패턴 추출 → 빈도순 정렬"""
    if not text:
        return []
    nums = {}
    for m in re.finditer(r"(\d{1,3}(?:,\d{3})+)", text):
        n = int(m.group().replace(",", ""))
        if min_v <= n <= max_v:
            nums[n] = nums.get(n, 0) + 1
    sorted_nums = sorted(nums.items(), key=lambda x: -x[1])
    return [f"{n:,}원" for n, _ in sorted_nums[:5]]


def first_price(html, min_v=50_000, max_v=5_000_000):
    prices = extract_prices(html, min_v, max_v)
    return prices[0] if prices else None


# ── 사이트별 스크래퍼 ─────────────────────────────────────────────────────────

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
        "속전속결 전기기사 종합 패키지":      "https://www.e-dasan.net/shopItem?gcode=UGLMVEZ&gcd=2025&cate=662",
        "속전속결 전기공사기사 종합 패키지":  "https://www.e-dasan.net/shopItem?gcode=WDIOWBO1&gcd=1154&cate=662",
    }
    for name, url in urls.items():
        html = fetch(url)
        p = first_price(html, 100_000, 1_500_000)
        results[name] = p
    return results


@scraper("모아바")
def scrape_moaba():
    html = fetch("https://fireegfp.moa-ba.com/lecture.php?code=010301&menu_code=0107")
    prices = extract_prices(html or "", 200_000, 1_500_000)
    result = {}
    if len(prices) >= 1:
        result["쌍기사 올인원 패스"] = prices[0]
    return result


@scraper("에듀야")
def scrape_eduya():
    html = fetch("https://www.eduyaa.com/product/class_apply/package/2/")
    if not html:
        html = fetch("https://sh.eduyaa.com/main/")
    prices = extract_prices(html or "", 300_000, 2_000_000)
    return {
        "1,2차 골드평생합격반": prices[0] if prices else None,
        "골드vip 1,2차 합격반": prices[1] if len(prices) > 1 else None,
    }


@scraper("계리단기")
def scrape_kaeri_danki():
    html = fetch("https://tech.conects.com/freepass/post")
    prices = extract_prices(html or "", 100_000, 1_000_000)
    return {
        "계리직 평생 프리패스 환급형": prices[0] if prices else None,
        "계리직 27대비 환급 프리패스": prices[1] if len(prices) > 1 else None,
    }


@scraper("유상통")
def scrape_yusangtong():
    html = fetch("https://eduon.com/yst/Contents/be_happy")
    p1 = first_price(html, 100_000, 1_000_000)
    html2 = fetch("https://eduon.com/yst/contents/dont_worry")
    p2 = first_price(html2, 100_000, 1_000_000)
    return {"비해피패스": p1, "돈워리패스": p2}


@scraper("지안에듀")
def scrape_jianedu():
    for url in ["https://zianedu.com/", "https://www.zianedu.com/"]:
        html = fetch(url)
        if html:
            p = first_price(html, 100_000, 1_000_000)
            return {"2027 계리직 730 지안패스": p}
    return {}


@scraper("공단기")
def scrape_gongdangi():
    html = fetch("https://gong.conects.com/freepass/renewal/9th")
    prices = extract_prices(html or "", 300_000, 3_000_000)
    return {
        "28대비 9급 프리미엄 환급 프리패스": prices[0] if prices else None,
        "전직렬 mini(비환급형)": prices[-1] if len(prices) > 1 else None,
    }


@scraper("박문각")
def scrape_pmg():
    result = {}
    pages = [
        ("https://www.pmg.co.kr/user/plo/event/event_allpass.asp",   200_000, 3_000_000,
         ["2026 기출 평생회원", "2026 평생회원", "2026 올패스 플러스"]),
        ("https://www.pmg.co.kr/user/pho/main.asp",                  200_000, 2_500_000,
         ["평생회원 100% 환급반", "평생회원", "26년+27년 필 합격반 플러스"]),
        ("https://www.pmg.co.kr/user/phjo/main.asp",                 100_000, 1_500_000,
         ["2026 동차 올패스"]),
        ("https://www.pmg.co.kr/user/human/main.asp",                100_000, 1_000_000,
         ["휴먼 합격패스(교재미포함)", "휴먼 합격패스(교재포함)"]),
        ("https://www.pmg.co.kr/user/pno/event/event_allpass.asp",   200_000, 2_000_000,
         ["28대비 스파르타 환급 올패스", "7대비 스파르타 환급 올패스"]),
        ("https://www.pmg.co.kr/user/spo/main.asp",                  100_000, 1_500_000,
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
        "1+2차 합격 패스": prices[1] if len(prices) > 1 else None,
    }


@scraper("해커스")
def scrape_hackers():
    result = {}
    pages = [
        ("https://land.hackers.com/",           500_000, 3_000_000,
         ["평생환급 평생수강반", "평생보장반", "2026+2027 2년합격반"]),
        ("https://house.hackers.com/",           300_000, 2_500_000,
         ["100% 환급평생반", "평생보장 프리미엄"]),
        ("https://sabok.edu2080.co.kr/",         100_000, 1_000_000,
         ["장학금반", "합격보장반(기본연장반)"]),
        ("https://gumjung.edu2080.co.kr/",       100_000, 1_000_000,
         ["고졸 검정고시 무제한 연장반", "검정고시 환급반"]),
        ("https://egosi.hackers.com/site/?c=lec_9", 200_000, 3_000_000,
         ["9급 행정직 전직렬 합불 0원 패스 2028", "7대비 스파르타 환급 올패스", "9급 직렬별 합불 0원 패스"]),
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


# ── course-X-comparison.json 직접 업데이트 ───────────────────────────────────

def inject_price_into_value(text: str, price: str) -> str:
    """경쟁사 value 텍스트의 두 번째 줄(가격 위치)을 교체"""
    lines = text.split("\n")
    if len(lines) < 2:
        return text
    lines[1] = price
    return "\n".join(lines)


def update_comparison_jsons(prices: dict):
    changed_files = []
    for fname in sorted(os.listdir(DATA_DIR)):
        if not fname.startswith("course-") or not fname.endswith("-comparison.json"):
            continue
        fpath = os.path.join(DATA_DIR, fname)
        with open(fpath, encoding="utf-8") as f:
            data = json.load(f)

        comp_id_to_name = {str(c["id"]): c["name"] for c in data.get("competitors", [])}
        modified = False

        for item in data.get("items", []):
            for cid, val in item.get("competitor_values", {}).items():
                cname = comp_id_to_name.get(cid)
                if not cname:
                    continue
                lines = val.split("\n")
                if not lines:
                    continue
                product_name = lines[0]
                new_price = prices.get(cname, {}).get(product_name)
                if new_price and new_price != "가격 문의" and len(lines) >= 2:
                    new_val = inject_price_into_value(val, new_price)
                    if new_val != val:
                        item["competitor_values"][cid] = new_val
                        modified = True

        if modified:
            with open(fpath, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            changed_files.append(fname)
            print(f"  ✅ {fname} 업데이트")

    return changed_files


# ── 메인 ──────────────────────────────────────────────────────────────────────

def main():
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M KST")
    print(f"\n{'='*55}")
    print(f"[CI Price Update] {now}")
    print(f"{'='*55}\n")

    all_scraped = {}
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

    print(f"\n스크래핑: 총 {ok}건 확인, {fail}개 사이트 오류\n")

    prices = update_price_config(all_scraped)

    changed = update_comparison_jsons(prices)
    if not changed:
        print("  변경된 가격 없음")

    print(f"\n✅ 완료 — {now}")


if __name__ == "__main__":
    main()
