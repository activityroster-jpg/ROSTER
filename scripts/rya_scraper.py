"""
RYA "Where's my nearest" sweep -> CSV in the outreach-import format.

Run:    python3 scripts/rya_scraper.py            (full sweep, resumable)
Check:  python3 scripts/rya_scraper.py --check    (report on the CSV only)
Output: rya_all_raw.csv (+ rya_progress.json state) in the current folder.

How it works: the directory always shows the nearest 20 clubs / training
centres to a point, and embeds each one's coordinates for the map. Starting
from 1-degree cells over the UK, Ireland, Isle of Man and Channel Islands, it
searches each cell's centre; if the 20th result is farther away than the
cell's corners, the cell is fully covered, otherwise the cell is split in four
and each quarter is searched. That guarantees nothing is missed in dense areas
(Solent, Clyde, Lakes) without hammering sparse ones. It then opens each
listing and reads the address, phone, website and email the RYA publishes.
Race officials and launch points are filtered out in the query.

Polite: 1.5 s between requests; robots.txt allows crawling. A full run takes
roughly 1-3 hours. Ctrl+C and re-run to resume; failed fetches are retried.

--overseas runs a second pass over the rest of the world (after the UK pass),
appending to the same CSV with region "Overseas" and the country. It also
collects listings the RYA has no location for (stored at 0,0), which no
location search can reach; those can be UK or overseas.
--clean fixes county-in-city rows in an existing CSV.
--check prints row count, blank names/emails, duplicates and non-UK/IE rows.
"""
import csv, json, math, os, re, sys, time
from collections import Counter

BASE = "https://www.rya.org.uk/wheres-my-nearest/"
DELAY = 1.5             # seconds between requests
MIN_HALF = 0.004        # stop splitting cells below ~0.5 km across
OUT = "rya_all_raw.csv"
STATE = "rya_progress.json"
OVERSEAS_STATE = "rya_progress_overseas.json"
OVERSEAS = "--overseas" in sys.argv  # second pass: the rest of the world
DEBUG_HTML = "rya_debug_listing.html"

HEAD = {"User-Agent": "Mozilla/5.0 (outreach research; contact via website)"}
HEADERS = ["name", "region", "address 1", "address 2", "city", "postcode", "country",
           "email", "website", "linkedin", "contact", "role", "notes", "full address"]

REGION = {}
for r, areas in {
 "Scotland": "AB DD DG EH FK G HS IV KA KW KY ML PA PH TD ZE",
 "Wales": "CF LD LL NP SA",
 "Northern Ireland": "BT",
 "London": "E EC N NW SE SW W WC BR CR EN HA IG KT RM SM TW UB",
 "South East": "BN CT GU HP ME MK OX PO RG RH SL SO TN DA",
 "South West": "BA BH BS DT EX GL PL SN SP TA TQ TR",
 "East": "AL CB CM CO IP LU NR PE SG SS WD",
 "East Midlands": "DE LE LN NG NN",
 "West Midlands": "B CV DY HR ST SY TF WR WS WV",
 "Yorkshire": "BD DN HD HG HU HX LS S WF YO",
 "North West": "BB BL CA CH CW FY L LA M OL PR SK WA WN",
 "North East": "DH DL NE SR TS",
 "Channel Islands": "GY JE",
 "Isle of Man": "IM",
}.items():
    for a in areas.split():
        REGION[a] = r

UK_PC = re.compile(r"\b([A-Z]{1,2})\d[A-Z\d]?\s*\d[A-Z]{2}\b")
EIRCODE = re.compile(r"^[AC-FHKNPRTV-Y]\d[\dW]\s?[AC-FHKNPRTV-Y\d]{4}$", re.I)
HOME_WORDS = ("United Kingdom", "Ireland", "Isle of Man", "Jersey", "Guernsey", "Alderney")
# Counties / ceremonial areas that RYA addresses put between town and postcode.
COUNTIES = {c.lower() for c in """
Bedfordshire Berkshire Buckinghamshire Cambridgeshire Cheshire Cornwall Cumbria
Derbyshire Devon Dorset Essex Gloucestershire Hampshire Herefordshire Hertfordshire
Kent Lancashire Leicestershire Lincolnshire Merseyside Norfolk Northamptonshire
Northumberland Nottinghamshire Oxfordshire Rutland Shropshire Somerset Staffordshire Suffolk
Surrey Sussex Warwickshire Wiltshire Worcestershire Yorkshire Middlesex Cumberland
Westmorland Anglesey Gwynedd Denbighshire Flintshire Powys Ceredigion
Pembrokeshire Carmarthenshire Glamorgan Monmouthshire Argyll Ayrshire Fife Lanarkshire
Renfrewshire Dunbartonshire Stirlingshire Perthshire Angus Aberdeenshire Morayshire Moray
Highland Lothian Midlothian Borders Dumfriesshire Galloway Kincardineshire Caithness
Sutherland Orkney Shetland Down Fermanagh Tyrone
""".split()} | {"east sussex", "west sussex", "north yorkshire", "south yorkshire",
               "west yorkshire", "east yorkshire", "east riding of yorkshire", "isle of wight",
               "greater london", "greater manchester", "west midlands", "tyne and wear",
               "county durham", "west lothian", "east lothian", "argyll and bute",
               "scottish borders", "dumfries and galloway", "isle of anglesey",
               "vale of glamorgan", "north ayrshire", "south ayrshire", "east ayrshire",
               "western isles", "na h-eileanan siar", "perth and kinross"} | {c.lower() for c in """
Carlow Cavan Clare Cork Donegal Dublin Galway Kerry Kildare Kilkenny Laois Leitrim Limerick
Longford Louth Mayo Meath Monaghan Offaly Roscommon Sligo Tipperary Waterford Westmeath
Wexford Wicklow
""".split()}


def is_county(part):
    p = part.strip()
    return bool(re.match(r"^(County\s|Co\.\s*|Co\s)\S", p)) or p.lower() in COUNTIES


STREETISH = re.compile(r"\d|\b(Road|Rd|Street|Lane|Way|Quay|Pier|Park|Estate|Drive|Avenue|"
                       r"Close|Walk|Parade|Wharf|Business|Industrial|Unit|House|Buildings?|"
                       r"Marina|Slip|Yard|Campus|University|Centre|Club)\b", re.I)
COUNTRY_WORDS = ("United Kingdom", "Republic Of Ireland", "Republic of Ireland", "Ireland",
                 "Northern Ireland", "Isle of Man", "Jersey", "Guernsey", "Channel Islands")


def region_for(address, postcode):
    if EIRCODE.match(postcode or ""):
        return "Ireland"
    m = UK_PC.search(postcode or "")
    if m:
        return REGION.get(m.group(1), "CHECK (" + m.group(1) + ")")
    if "Ireland" in address and "Northern" not in address and "United Kingdom" not in address:
        return "Ireland"
    return "CHECK"


def country_for(region):
    return {"Ireland": "Ireland", "Isle of Man": "Isle of Man",
            "Channel Islands": "Channel Islands"}.get(region, "United Kingdom")


# --- HTTP ------------------------------------------------------------------

_session = None


def get(url):
    """Return page HTML, or None on failure (so callers can retry next run)."""
    global _session
    import requests
    if _session is None:
        _session = requests.Session()
        _session.headers.update(HEAD)
    for attempt in range(3):
        try:
            r = _session.get(url, timeout=30)
            if r.status_code == 200:
                return r.text
            print("  HTTP", r.status_code, url)
            if r.status_code == 404:
                return None
        except requests.RequestException as e:
            print("  error:", e)
        time.sleep(5 * (attempt + 1))
    return None


# --- Step 1: listings ------------------------------------------------------

LOC_RE = re.compile(r"\{Id:(\d+),Name:.*?,Latitude:(-?[\d.]+),Longitude:(-?[\d.]+)")


def parse_listing(html):
    """Return [(slug, lat, lng)] for each club / training centre on a results page.
    The page embeds every result's coordinates in a script block (for the map);
    cards carry the same Id in aria-describedby="locationTypes_<Id> ..."."""
    from bs4 import BeautifulSoup
    coords = {i: (float(la), float(ln)) for i, la, ln in LOC_RE.findall(html)}
    soup = BeautifulSoup(html, "html.parser")
    found = []
    for a in soup.find_all("a", href=True):
        if a.get_text(strip=True).lower() != "more info":
            continue
        li = a.find_parent("li")
        h4 = li.find("h4") if li else None
        m = re.search(r"locationTypes_(\d+)", (h4.get("aria-describedby") or "") if h4 else "")
        kinds = li.get_text(" ", strip=True) if li else ""
        if "Race Official" in kinds and "Club" not in kinds and "Training Centre" not in kinds:
            continue  # individual race officials - skip (also filtered in the query)
        slug = a["href"].split("?")[0].split("#")[0].rstrip("/").split("/")[-1]
        if not slug or slug == "wheres-my-nearest":
            continue
        la, ln = coords.get(m.group(1), (None, None)) if m else (None, None)
        found.append((slug, la, ln))
    return found


def listing(lat, lng):
    """Nearest-20 clubs/training centres to a point. None if the fetch failed."""
    url = (f"{BASE}?lat={lat}&lng={lng}&locationType=Club&locationType=Training_Centre"
           f"&locationSearch=&useBrowserLocation=false")
    html = get(url)
    if html is None:
        return None
    found = parse_listing(html)
    if not found:
        with open(DEBUG_HTML, "w", encoding="utf-8") as f:
            f.write(html)
    return found


def km(la1, ln1, la2, ln2):
    p = math.pi / 180
    a = (math.sin((la2 - la1) * p / 2) ** 2
         + math.cos(la1 * p) * math.cos(la2 * p) * math.sin((ln2 - ln1) * p / 2) ** 2)
    return 12742 * math.asin(math.sqrt(a))


def cell_radius_km(la, ln, h):
    """Distance from a cell's centre to its farthest corner (cell = centre +/- h degrees)."""
    return max(km(la, ln, la + dy, ln + dx) for dy in (-h, h) for dx in (-h, h))


def inside_uk_pass(la, ln, h):
    """True if the cell lies entirely within the area the UK & Ireland pass covered."""
    return la - h >= 49.0 and la + h <= 62.0 and ln - h >= -11.0 and ln + h <= 3.0


def start_cells():
    """1-degree cells over the UK, Ireland, Isle of Man and Channel Islands
    (or 20-degree cells over the whole world with --overseas)."""
    cells = []
    if OVERSEAS:
        for la in range(-50, 80, 20):
            for ln in range(-170, 180, 20):
                cells.append([float(la), float(ln), 10.0])
        return cells
    la = 49.5
    while la < 61.5:
        ln = -10.5
        while ln < 2.5:
            cells.append([la, ln, 0.5])
            ln += 1.0
        la += 1.0
    return cells


# --- Step 2: detail pages --------------------------------------------------

def field(text, label, stop):
    m = re.search(label + r"\s*:\s*(.+?)\s*(?:" + stop + r"|$)", text, re.S)
    return m.group(1).strip() if m else ""


def detail(slug):
    """Row for the CSV, "" if the page is not a UK/IE organisation, None on fetch failure."""
    from bs4 import BeautifulSoup
    html = get(BASE + slug + "/")
    if html is None:
        return None
    soup = BeautifulSoup(html, "html.parser")
    h1 = soup.find("h1")
    name = (h1.get_text(" ", strip=True) if h1 else "") or slug.replace("-", " ").title()
    main = soup.find("main") or soup
    text = main.get_text(" ", strip=True)
    labels = r"Telephone numbers|Website|Email addresses|Back to search results|Address\s*:"
    address = field(text, "Address", labels)
    phone = field(text, "Telephone numbers", labels)
    website = (field(text, "Website", labels).split(" ") or [""])[0]
    emails = []
    for e in re.findall(r"[\w.+-]+@[\w-]+\.[\w.-]+", field(text, "Email addresses", labels) or ""):
        e = e.rstrip(".")
        if e.lower() not in [x.lower() for x in emails] and not e.lower().endswith("rya.org.uk"):
            emails.append(e)
    services = [s for s in ("Training Centre", "OnBoard Club", "Club", "Sailability Centre",
                            "ICCTestCentre") if s in text]
    if not address:
        return ""  # not an organisation
    if not any(w in address for w in HOME_WORDS):
        if not OVERSEAS:
            return ""  # overseas - collected by the --overseas pass
        return overseas_row(name, address, phone, website, emails, services, slug)
    parts = [p.strip() for p in address.split(",") if p.strip() and p.strip() not in COUNTRY_WORDS]
    pc = ""
    if parts and (UK_PC.search(parts[-1].upper()) or EIRCODE.match(parts[-1])):
        pc = parts.pop().upper()
    city = parts.pop() if parts else ""
    if parts and is_county(city) and not STREETISH.search(parts[-1]):
        city = parts.pop()
    addr1 = parts[0] if parts else ""
    addr2 = ", ".join(parts[1:]) if len(parts) > 1 else ""
    notes = "Source: RYA listing (" + BASE + slug + "/). Services: " + ", ".join(services)
    if phone:
        notes += ". Tel " + re.sub(r"\s*(Club|Training Centre):.*", "", phone)
    if len(emails) > 1:
        notes += ". Other emails: " + ", ".join(emails[1:])
    region = region_for(address, pc)
    full = ", ".join(p for p in (addr1, addr2, city, pc) if p)
    return [name, region, addr1, addr2, city, pc, country_for(region),
            emails[0] if emails else "", website, "", "", "", notes, full]


def overseas_row(name, address, phone, website, emails, services, slug):
    """Overseas address: "street, ..., town, postcode, country/region"."""
    parts = [p.strip() for p in address.split(",") if p.strip()]
    country = parts.pop() if parts and not re.search(r"\d", parts[-1]) else ""
    pc = ""
    if parts and re.search(r"\d", parts[-1]) and len(parts[-1]) <= 10:
        pc = parts.pop()
    city = parts.pop() if parts else ""
    addr1 = parts[0] if parts else ""
    addr2 = ", ".join(parts[1:]) if len(parts) > 1 else ""
    notes = "Source: RYA listing (" + BASE + slug + "/). Services: " + ", ".join(services)
    if phone:
        notes += ". Tel " + re.sub(r"\s*(Club|Training Centre):.*", "", phone)
    if len(emails) > 1:
        notes += ". Other emails: " + ", ".join(emails[1:])
    full = ", ".join(p for p in (addr1, addr2, city, pc, country) if p)
    return [name, "Overseas", addr1, addr2, city, pc, country or "Overseas",
            emails[0] if emails else "", website, "", "", "", notes, full]


# --- main ------------------------------------------------------------------

def load_state():
    if OVERSEAS:
        global STATE
        STATE = OVERSEAS_STATE
    if os.path.exists(STATE):
        s = json.load(open(STATE))
        if s.get("version") == 3:
            return s
        print("Old-format progress file found; starting a fresh sweep.")
    state = {"version": 3, "queue": start_cells(), "done_cells": 0, "slugs": [],
             "done_slugs": [], "failures": 0}
    if OVERSEAS and os.path.exists(OVERSEAS_STATE.replace("_overseas", "")):
        # Skip everything the UK & Ireland pass already collected.
        state["known"] = json.load(open(OVERSEAS_STATE.replace("_overseas", "")))["slugs"]
    return state


def save(state):
    tmp = STATE + ".tmp"
    json.dump(state, open(tmp, "w"))
    os.replace(tmp, STATE)


def main():
    state = load_state()
    slugs = list(state["slugs"])
    slug_set = set(slugs) | set(state.get("known", []))

    # Coverage sweep (quadtree). Each query returns the nearest 20 results with
    # coordinates. If the 20th is farther away than the cell's corners, every
    # organisation in that cell is in the results; otherwise split the cell in 4.
    if OVERSEAS and not state.get("nolocation_done"):
        # Listings with no location are stored at 0,0, so no search near a real place
        # ever reaches them. Search at 0,0 per type: once a result list contains a
        # real location, every 0,0 listing of that type has been returned.
        for kind in ("Club", "Training_Centre"):
            html = get(f"{BASE}?lat=0&lng=0&locationType={kind}&locationSearch=&useBrowserLocation=false")
            time.sleep(DELAY)
            if html is None:
                print("Could not fetch the no-location listings; re-run to retry.")
                sys.exit(1)
            found = parse_listing(html)
            zero = [sl for sl, a, b in found if (a, b) in ((0.0, 0.0), (None, None))]
            if len(zero) == len(found):
                print(f"  warning: all {len(found)} {kind} results have no location - list may be truncated")
            new = [sl for sl in zero if sl not in slug_set]
            slugs += new
            slug_set.update(new)
            print(f"  {len(zero)} {kind} listings have no location ({len(new)} new)")
        state["nolocation_done"] = True
        state["slugs"] = slugs
        save(state)

    print(f"Step 1/2: coverage sweep ({len(state['queue'])} cells queued, "
          f"{state['done_cells']} done, {len(slugs)} organisations so far)")
    n = 0
    while state["queue"]:
        la, ln, h = state["queue"][0]
        if OVERSEAS and inside_uk_pass(la, ln, h):
            state["queue"].pop(0)  # already fully covered by the UK & Ireland pass
            continue
        found = listing(round(la, 5), round(ln, 5))
        time.sleep(DELAY)
        if found is None:
            state["queue"].append(state["queue"].pop(0))  # retry later
            state["failures"] += 1
            if state["failures"] > 200:
                print("Too many failed requests - is the site reachable? Stopping; re-run to resume.")
                save(state)
                sys.exit(1)
            continue
        state["queue"].pop(0)
        if not found and not slugs:
            print(f"\n0 organisations returned - the RYA page layout has probably changed. "
                  f"Saved the page to {DEBUG_HTML} for inspection.")
            save(state)
            sys.exit(2)
        new = [s for s, _, _ in found if s not in slug_set]
        slugs += new
        slug_set.update(new)
        state["done_cells"] += 1

        # Results are ordered by their stored coordinates; ones we couldn't parse are
        # ignored (they used to force a split everywhere they appeared). Listings with
        # no location are stored at 0,0 and are collected by --nolocation instead.
        dists = [km(la, ln, a, b) for _, a, b in found if a is not None]
        full_page = len(found) >= 20
        if full_page and dists and max(dists) < cell_radius_km(la, ln, h):
            if h / 2 >= MIN_HALF:
                q = h / 2
                for dy in (-q, q):
                    for dx in (-q, q):
                        state["queue"].append([la + dy, ln + dx, q])
            else:
                state.setdefault("dense_spots", []).append([la, ln])

        n += 1
        if n % 25 == 0:
            print(f"  {state['done_cells']} cells searched, {len(state['queue'])} queued, "
                  f"{len(slugs)} organisations found", flush=True)
            state["slugs"] = slugs
            save(state)
    state["slugs"] = slugs
    save(state)
    print(f"Sweep complete: {len(slugs)} organisations from {state['done_cells']} searches"
          + (f" ({len(state.get('dense_spots', []))} very dense spots hit the size limit)"
             if state.get("dense_spots") else ""))

    done_slugs = set(state["done_slugs"])
    todo = [s for s in slugs if s not in done_slugs]
    print(f"Step 2/2: reading {len(todo)} of {len(slugs)} listings")
    new_file = not os.path.exists(OUT)
    with open(OUT, "a", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        if new_file:
            w.writerow(HEADERS)
        for i, s in enumerate(todo, 1):
            row = detail(s)
            time.sleep(DELAY)
            if row is None:
                continue  # fetch failed - retried on next run
            if row:
                w.writerow(row)
            state["done_slugs"].append(s)
            if i % 25 == 0:
                print(f"  {i}/{len(todo)}", flush=True)
                f.flush()
                save(state)
    save(state)
    left = len(slugs) - len(state["done_slugs"])
    print(f"Done -> {OUT}" + (f" ({left} listings failed to load - re-run to retry)" if left else ""))
    check()


def clean(path=OUT):
    """Tidy an existing CSV in place: town back into the city column where a county
    (or "Channel Isles") landed there, regions recomputed from postcodes, blank
    region + a note where the RYA publishes no address, and duplicates dropped."""
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    moved = regioned = noaddr = 0
    out, seen = [], set()
    for r in rows:
        if r["city"] and (is_county(r["city"]) or r["city"] in ("Channel Isles", "Channel Islands")) \
                and (r["address 2"] or r["address 1"]):
            src = "address 2" if r["address 2"] else "address 1"
            parts = [p.strip() for p in r[src].split(",") if p.strip()]
            if (src == "address 2" or len(parts) >= 2) and not STREETISH.search(parts[-1]):
                r["city"] = parts.pop()
                r[src] = ", ".join(parts)
                moved += 1
        if r["region"] != "Overseas":
            if r["postcode"]:
                new = region_for(r["full address"], r["postcode"])
                if new != r["region"]:
                    r["region"], regioned = new, regioned + 1
                    r["country"] = country_for(new)
            elif r["region"].startswith("CHECK"):
                r["region"] = ""
                if "No address published" not in r["notes"]:
                    r["notes"] += ". No address published by the RYA"
                noaddr += 1
        key = (r["name"].strip().lower(), r["postcode"].replace(" ", "").lower())
        if key in seen:
            continue
        seen.add(key)
        out.append(r)
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=HEADERS)
        w.writeheader()
        w.writerows(out)
    print(f"clean: town moved into city on {moved} rows; region fixed on {regioned}; "
          f"{noaddr} rows have no address; {len(rows) - len(out)} duplicates dropped")


def check(path=OUT):
    rows = list(csv.DictReader(open(path, encoding="utf-8")))
    print(f"\n{path}: {len(rows)} rows")
    blank_name = [r for r in rows if not r["name"].strip()]
    no_email = sum(1 for r in rows if not r["email"].strip())
    no_pc = sum(1 for r in rows if not r["postcode"].strip())
    keys = Counter((r["name"].strip().lower(), r["postcode"].replace(" ", "").lower()) for r in rows)
    dups = {k: c for k, c in keys.items() if c > 1}
    odd = [r for r in rows if r["region"].startswith("CHECK")]
    print(f"  overseas rows:          {sum(1 for r in rows if r['region'] == 'Overseas')}")
    print(f"  no region (no address): {sum(1 for r in rows if not r['region'])}")
    print(f"  blank names:            {len(blank_name)}")
    print(f"  no email:               {no_email}")
    print(f"  no postcode:            {no_pc}")
    print(f"  duplicate name+postcode: {len(dups)} keys ({sum(dups.values()) - len(dups)} extra rows)")
    print(f"  CHECK rows:             {len(odd)}")
    for r in odd[:30]:
        print(f"    - {r['name']} | {r['region']} | {r.get('country', '')} | {r['full address']}")
    print("  by region:", dict(Counter(r["region"] for r in rows).most_common()))


if __name__ == "__main__":
    if "--clean" in sys.argv:
        clean()
        sys.exit(0)
    if "--check" in sys.argv:
        check()
        sys.exit(0)
    try:
        main()
    except KeyboardInterrupt:
        print("\nStopped. Run again to resume.")
        sys.exit(0)
