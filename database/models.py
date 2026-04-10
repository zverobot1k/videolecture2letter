from __future__ import annotations

from datetime import datetime
from enum import Enum

from sqlalchemy import DateTime, Enum as SQLEnum, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database.database import Base


class SummarySize(str, Enum):
	short = "short"
	medium = "medium"
	detailed = "detailed"


class SummaryStatus(str, Enum):
	queued = "queued"
	processing = "processing"
	done = "done"
	failed = "failed"


class User(Base):
	__tablename__ = "users"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	email: Mapped[str] = mapped_column(String(255), unique=True, index=True, nullable=False)
	password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
	balance_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		server_default=func.now(),
		onupdate=func.now(),
		nullable=False,
	)

	summaries: Mapped[list["Summary"]] = relationship(
		"Summary",
		back_populates="user",
		cascade="all, delete-orphan",
	)


class Summary(Base):
	__tablename__ = "summaries"

	id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
	user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True, nullable=False)
	task_id: Mapped[str | None] = mapped_column(String(255), unique=True, index=True, nullable=True)
	source_url: Mapped[str] = mapped_column(Text, nullable=False)
	prompt: Mapped[str] = mapped_column(Text, nullable=False)
	size: Mapped[str] = mapped_column(String(32), nullable=False)
	token_cost: Mapped[int] = mapped_column(Integer, nullable=False)
	status: Mapped[str] = mapped_column(
		SQLEnum(SummaryStatus, name="summary_status"),
		nullable=False,
		default=SummaryStatus.queued,
	)
	file_path: Mapped[str | None] = mapped_column(Text, nullable=True)
	error: Mapped[str | None] = mapped_column(Text, nullable=True)
	created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
	updated_at: Mapped[datetime] = mapped_column(
		DateTime(timezone=True),
		server_default=func.now(),
		onupdate=func.now(),
		nullable=False,
	)

	user: Mapped[User] = relationship("User", back_populates="summaries")