import importlib
import app.workers.tasks as tmod
importlib.reload(tmod)
from app.workers.tasks import parse_and_store_results
from app.database import get_sync_db
from app.models.molecule import Molecule

db = get_sync_db()
db.execute(Molecule.__table__.delete().where(Molecule.task_id == '6d42bcd6-a250-41f7-81e2-56718847a090'))
db.commit()
parse_and_store_results('6d42bcd6-a250-41f7-81e2-56718847a090', 'G:/claude/plantform/data/results/6d42bcd6-a250-41f7-81e2-56718847a090', db)
db.close()
print('done')
