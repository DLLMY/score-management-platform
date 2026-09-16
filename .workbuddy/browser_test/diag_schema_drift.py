import sys, os
_PROJ = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_BACKEND = os.path.join(_PROJ, "apps", "backend")
sys.path.insert(0, _BACKEND)
os.chdir(_BACKEND)
from app import create_app
from sqlalchemy import inspect as sa_inspect, text
app = create_app()
with app.app_context():
    sa = app.extensions.get('sqlalchemy')
    if sa is None:
        print("cannot find sqlalchemy ext"); sys.exit(1)
    insp = sa_inspect(sa.engine)
    md = sa.metadata
    tables = md.sorted_tables
    report = []
    for t in tables:
        tname = t.name
        try:
            db_cols = {c["name"]: c for c in insp.get_columns(tname)}
        except Exception as e:
            report.append(f"[SKIP] {tname}: cannot inspect ({e})")
            continue
        model_cols = {c.name: c for c in t.columns}
        missing = [cname for cname in model_cols if cname not in db_cols]
        extra = [cname for cname in db_cols if cname not in model_cols]
        if missing:
            report.append(f"[DRIFT] {tname}: missing in DB {missing}")
        if extra:
            report.append(f"[EXTRA] {tname}: in DB not in model {extra}")
    print("\n".join(report) if report else "NO DRIFT")
    # also print table count
    print("--- total model tables:", len(tables))
