import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker


DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./softwarepr.db")

engine_kwargs = {"future": True, "pool_pre_ping": True}
if DATABASE_URL.startswith("sqlite"):
	engine_kwargs["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)
Base = declarative_base()


def get_db():
	db = SessionLocal()
	try:
		yield db
	finally:
		db.close()


def init_db():
	from database import models  # noqa: F401

	Base.metadata.create_all(bind=engine)
