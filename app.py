# app.py
import os
import uuid
from datetime import date, datetime, timedelta, timezone

from flask import Flask, jsonify, request, render_template, abort
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS

# -----------------------------------------------------------------------------
# App & DB Setup
# -----------------------------------------------------------------------------

db = SQLAlchemy()

DEFAULT_DB_URL = "sqlite:///cashflow_canvas.db"


def create_app() -> Flask:
    """Application factory."""
    app = Flask(__name__, template_folder="templates", static_folder="static")

    # Basic config
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv("DATABASE_URL", DEFAULT_DB_URL)
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["JSON_SORT_KEYS"] = False

    CORS(app)
    db.init_app(app)

    with app.app_context():
        db.create_all()
        
        if Account.query.first() is None and Category.query.first() is None:
            seed_defaults()

    register_routes(app)
    return app


# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------

class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)

    uuid = db.Column(
        db.String(36),
        unique=True,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
    )
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)

    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False, default="cash")
    initial_balance = db.Column(db.Numeric(10, 2), nullable=False, default=0)

    transactions = db.relationship("Transaction", backref="account", lazy=True)

    def __repr__(self) -> str:  # small debug helper
        return f"<Account id={self.id} name={self.name!r}>"

    def to_dict(self, range_totals=None) -> dict:
        data = {
            "id": self.id,
            "uuid": self.uuid,
            "name": self.name,
            "type": self.type,
            "initial_balance": float(self.initial_balance),
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_deleted": self.is_deleted,
        }
        if range_totals is not None:
            data["expense_total"] = float(range_totals.get("expense", 0.0))
            data["income_total"] = float(range_totals.get("income", 0.0))
        return data


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)

    uuid = db.Column(
        db.String(36),
        unique=True,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
    )
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)

    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(50), nullable=False, default="expense")

    transactions = db.relationship("Transaction", backref="category", lazy=True)

    def __repr__(self) -> str:
        return f"<Category id={self.id} name={self.name!r}>"

    def to_dict(self, range_totals=None) -> dict:
        data = {
            "id": self.id,
            "uuid": self.uuid,
            "name": self.name,
            "type": self.type,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_deleted": self.is_deleted,
        }
        if range_totals is not None:
            data["expense_total"] = float(range_totals.get("expense", 0.0))
            data["income_total"] = float(range_totals.get("income", 0.0))
        return data


class Transaction(db.Model):
    """
    Generic transaction for both expenses & income.
    type: 'expense' or 'income'

    Sync-ready:
    - uuid: global identifier for sync
    - updated_at: last change timestamp
    - is_deleted: soft delete flag
    """

    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)

    uuid = db.Column(
        db.String(36),
        unique=True,
        nullable=False,
        default=lambda: str(uuid.uuid4()),
    )
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    is_deleted = db.Column(db.Boolean, nullable=False, default=False)

    type = db.Column(db.String(20), nullable=False, default="expense")
    amount = db.Column(db.Numeric(10, 2), nullable=False)
    date = db.Column(db.Date, nullable=False, default=date.today)
    description = db.Column(db.String(255), nullable=True)

    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)

    def __repr__(self) -> str:
        return f"<Transaction id={self.id} type={self.type} amount={self.amount}>"

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "uuid": self.uuid,
            "type": self.type,
            "amount": float(self.amount),
            "date": self.date.isoformat(),
            "description": self.description,

            "category_id": self.category_id,
            "category_uuid": self.category.uuid if self.category else None,
            "category_name": self.category.name if self.category else None,

            "account_id": self.account_id,
            "account_uuid": self.account.uuid if self.account else None,
            "account_name": self.account.name if self.account else None,

            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_deleted": self.is_deleted,
        }


class Budget(db.Model):
    """Simple category / overall budget for a given period."""

    __tablename__ = "budgets"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    amount = db.Column(db.Numeric(10, 2), nullable=False)

    # 'monthly', 'weekly', 'custom', etc. (free-form for now)
    period = db.Column(db.String(50), nullable=False, default="monthly")

    start_date = db.Column(db.Date, nullable=True)
    end_date = db.Column(db.Date, nullable=True)

    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    category = db.relationship("Category", lazy=True)

    def __repr__(self) -> str:
        return f"<Budget id={self.id} name={self.name!r}>"

    def to_dict(self, spent: float = 0.0) -> dict:
        total_amount = float(self.amount or 0)
        spent_val = float(spent or 0)
        remaining = total_amount - spent_val

        progress = 0.0
        if total_amount > 0:
            progress = max(0.0, min(1.0, spent_val / total_amount))

        return {
            "id": self.id,
            "name": self.name,
            "amount": total_amount,
            "period": self.period,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "category_id": self.category_id,
            "category_name": self.category.name if self.category else None,
            "spent": spent_val,
            "remaining": remaining,
            "progress": progress,  # 0.0 - 1.0 for progress bar
        }


# -----------------------------------------------------------------------------
# Seed Data (for demo)
# -----------------------------------------------------------------------------

def seed_defaults() -> None:
    """Seed some default accounts & categories for a smoother demo."""
    # if not Account.query.first():
    #     # demo_accounts = [
    #     #     Account(name="Cash", type="cash", initial_balance=0),
    #     #     Account(name="Credit Card 1", type="credit", initial_balance=0),
    #     #     Account(name="Debit Card 1", type="debit", initial_balance=0),
    #     #     Account(name="Debit Card 2", type="debit", initial_balance=0),
    #     #     Account(name="Meal Card", type="prepaid", initial_balance=0),
    #     # ]

    #     demo_accounts = []

    #     for a in demo_accounts:
    #         exists = Account.query.filter_by(name=a.name, type=a.type).first()
    #         if not exists:
    #             db.session.add(Account(**a))

    # if not Category.query.first():
    #     demo_categories = [
    #         Category(name="Groceries", type="expense"),
    #         Category(name="Rent", type="expense"),
    #         Category(name="Utilities", type="expense"),
    #         Category(name="Dining Out", type="expense"),
    #         Category(name="Transport", type="expense"),
    #         Category(name="Salary", type="income"),
    #         Category(name="Side Hustle", type="income"),
    #     ]

    #     for c in demo_categories:
    #         exists = Category.query.filter_by(name=c.name, type=c.type).first()
    #         if not exists:
    #             db.session.add(Category(**c))

    # db.session.commit()
    pass


# -----------------------------------------------------------------------------
# Helpers: Time Ranges & Query Filters
# -----------------------------------------------------------------------------

def parse_client_datetime(raw: str | None) -> datetime:
    """
    Parse an ISO datetime string from the client into a naive UTC datetime.

    - Handles "Z" suffix by converting to +00:00
    - Handles timezone-aware values by converting to UTC and stripping tzinfo
    - Falls back to datetime.utcnow() on any error
    """
    if not raw:
        return datetime.utcnow()
    try:
        # Handle trailing "Z"
        raw_normalized = raw.replace("Z", "+00:00")
        dt = datetime.fromisoformat(raw_normalized)
        # If it's timezone-aware, convert to UTC and drop tzinfo -> naive
        if dt.tzinfo is not None:
            dt = dt.astimezone(timezone.utc).replace(tzinfo=None)
        return dt
    except Exception:
        return datetime.utcnow()


def parse_date(value: str | None, default=None):
    if not value:
        return default
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return default


def get_time_range(range_key: str, start_str: str | None = None, end_str: str | None = None):
    """
    Translate range_key into (start_date, end_date) inclusive.
    end_date is inclusive; used with <= comparisons.
    """
    today = date.today()

    # Custom date overrides if provided
    if start_str or end_str:
        start = parse_date(start_str, None)
        end = parse_date(end_str, None)
        return start, end

    if range_key == "day":
        return today, today
    if range_key == "week":
        # last 7 days including today
        return today - timedelta(days=6), today
    if range_key == "month":
        # last 30 days including today
        return today - timedelta(days=29), today
    if range_key == "3months":
        return today - timedelta(days=89), today
    if range_key == "6months":
        return today - timedelta(days=179), today

    # "all" or unknown -> no limit
    return None, None


def apply_date_filter(query, start_date, end_date):
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= end_date)
    return query


def active_transactions_query():
    """Base query for non-deleted transactions."""
    return Transaction.query.filter_by(is_deleted=False)


def active_accounts_query():
    """Base query for non-deleted accounts."""
    return Account.query.filter_by(is_deleted=False)


def active_categories_query():
    """Base query for non-deleted categories."""
    return Category.query.filter_by(is_deleted=False)


def resolve_fk_id_from_uuid(Model, uuid_val: str | None):
    if not uuid_val:
        return None
    obj = Model.query.filter_by(uuid=uuid_val).first()
    return obj.id if obj else None


# -----------------------------------------------------------------------------
# Routes
# -----------------------------------------------------------------------------

def register_routes(app: Flask) -> None:
    # ----------------------- UI ROUTE ----------------------------------------

    @app.route("/")
    def index():
        # Frontend SPA – tabs & UI logic live in index.html + app.js
        return render_template("index.html")

    # ----------------------- TRANSACTIONS / RECORDS --------------------------

    @app.route("/api/transactions", methods=["GET"])
    def list_transactions():
        """
        Query params:
          - range: day/week/month/3months/6months/all
          - start_date, end_date (yyyy-mm-dd) override
          - type: expense/income/all
          - account_id, category_id
        """
        range_key = request.args.get("range", "month")
        start_date, end_date = get_time_range(
            range_key,
            start_str=request.args.get("start_date"),
            end_str=request.args.get("end_date"),
        )

        tx_type = request.args.get("type", "all")
        account_id = request.args.get("account_id")
        category_id = request.args.get("category_id")

        query = active_transactions_query()
        if tx_type in ("expense", "income"):
            query = query.filter_by(type=tx_type)

        query = apply_date_filter(query, start_date, end_date)

        if account_id:
            query = query.filter_by(account_id=account_id)
        if category_id:
            query = query.filter_by(category_id=category_id)

        query = query.order_by(Transaction.date.desc(), Transaction.id.desc())
        items = [t.to_dict() for t in query.all()]

        return jsonify(
            {
                "range": range_key,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "items": items,
            }
        )

    @app.route("/api/transactions", methods=["POST"])
    def create_transaction():
        data = request.get_json(silent=True) or {}

        tx_type = data.get("type", "expense")
        if tx_type not in ("expense", "income"):
            tx_type = "expense"

        cat_uuid = data.get("category_uuid")
        acc_uuid = data.get("account_uuid")

        tx_date = parse_date(data.get("date"), date.today())
        amount = data.get("amount", 0)

        tx = Transaction(
            type=tx_type,
            amount=amount,
            date=tx_date,
            description=data.get("description"),
            category_id=resolve_fk_id_from_uuid(Category, cat_uuid) if cat_uuid else data.get("category_id"),
            account_id=resolve_fk_id_from_uuid(Account, acc_uuid) if acc_uuid else data.get("account_id"),
            updated_at=datetime.utcnow(),
        )
        db.session.add(tx)
        db.session.commit()

        return jsonify(tx.to_dict()), 201

    @app.route("/api/transactions/<int:tx_id>", methods=["PUT", "PATCH"])
    def update_transaction(tx_id):
        tx = Transaction.query.get_or_404(tx_id)
        data = request.get_json(silent=True) or {}

        cat_uuid = data.get("category_uuid")
        acc_uuid = data.get("account_uuid")

        # UUID-first updates
        if cat_uuid is not None:
            tx.category_id = resolve_fk_id_from_uuid(Category, cat_uuid)
        if acc_uuid is not None:
            tx.account_id = resolve_fk_id_from_uuid(Account, acc_uuid)


        if data.get("type") in ("expense", "income"):
            tx.type = data["type"]

        if "amount" in data:
            tx.amount = data["amount"]

        if "date" in data:
            tx.date = parse_date(data["date"], tx.date)

        if "description" in data:
            tx.description = data["description"]

        tx.updated_at = datetime.utcnow()

        db.session.commit()
        return jsonify(tx.to_dict())

    @app.route("/api/transactions/<int:tx_id>", methods=["DELETE"])
    def delete_transaction(tx_id):
        tx = Transaction.query.get_or_404(tx_id)
        tx.is_deleted = True
        tx.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"status": "deleted", "id": tx_id})
    

    @app.route("/api/transactions/uuid/<string:tx_uuid>", methods=["DELETE"])
    def delete_transaction_by_uuid(tx_uuid):
        tx = Transaction.query.filter_by(uuid=tx_uuid).first()
        if not tx:
            abort(404)
        tx.is_deleted = True
        tx.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"status": "deleted", "uuid": tx_uuid})


    @app.route("/api/accounts/uuid/<string:acc_uuid>", methods=["DELETE"])
    def delete_account_by_uuid(acc_uuid):
        acc = Account.query.filter_by(uuid=acc_uuid).first()
        if not acc:
            abort(404)
        acc.is_deleted = True
        acc.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"status": "deleted", "uuid": acc_uuid})

    # ----------------------- SYNC: ACCOUNTS ----------------------------

    @app.route("/api/sync/accounts", methods=["POST"])
    def sync_accounts_upload():
        """
        Upload local account changes from clients.
        """
        payload = request.get_json(silent=True) or {}
        print("payload: ",payload)
        items = payload.get("items", [])

        for item in items:
            uuid_val = item.get("uuid")
            if not uuid_val:
                continue

            client_updated = parse_client_datetime(item.get("updated_at"))

            existing = Account.query.filter_by(uuid=uuid_val).first()

            if existing:
                if client_updated > (existing.updated_at or datetime.min):
                    existing.name = item.get("name", existing.name)
                    existing.type = item.get("type", existing.type)
                    existing.initial_balance = item.get(
                        "initial_balance", existing.initial_balance
                    )
                    existing.is_deleted = item.get("is_deleted", existing.is_deleted)
                    existing.updated_at = client_updated
            else:
                acc = Account(
                    uuid=uuid_val,
                    name=item.get("name", "Unnamed Account"),
                    type=item.get("type", "cash"),
                    initial_balance=item.get("initial_balance", 0),
                    is_deleted=item.get("is_deleted", False),
                    updated_at=client_updated,
                )
                db.session.add(acc)

        db.session.commit()
        return jsonify({"status": "ok"})

    @app.route("/api/sync/accounts", methods=["GET"])
    def sync_accounts_download():
        """
        Download server-side account changes since a timestamp,
        but only non-deleted (softdelete=false) accounts.
        """
        since_raw = request.args.get("since")

        q = Account.query.order_by(Account.name.asc())

        if since_raw:
            since_dt = parse_client_datetime(since_raw)
            q = q.filter(Account.updated_at > since_dt)

        items = [a.to_dict() for a in q.all()]
        return jsonify({"items": items})


    # ----------------------- SYNC: CATEGORIES ----------------------------

    @app.route("/api/sync/categories", methods=["POST"])
    def sync_categories_upload():
        """
        Upload local category changes from clients.
        """
        payload = request.get_json(silent=True) or {}
        items = payload.get("items", [])

        for item in items:
            uuid_val = item.get("uuid")
            if not uuid_val:
                continue

            client_updated = parse_client_datetime(item.get("updated_at"))
            existing = Category.query.filter_by(uuid=uuid_val).first()

            if existing:
                if client_updated > (existing.updated_at or datetime.min):
                    existing.name = item.get("name", existing.name)
                    existing.type = item.get("type", existing.type)
                    existing.is_deleted = item.get("is_deleted", existing.is_deleted)
                    existing.updated_at = client_updated
            else:
                cat = Category(
                    uuid=uuid_val,
                    name=item.get("name", "Unnamed Category"),
                    type=item.get("type", "expense"),
                    is_deleted=item.get("is_deleted", False),
                    updated_at=client_updated,
                )
                db.session.add(cat)

        db.session.commit()
        return jsonify({"status": "ok"})

    @app.route("/api/sync/categories", methods=["GET"])
    def sync_categories_download():
        """
        Download server-side category changes since a timestamp.
        """
        since_raw = request.args.get("since")
        q = Category.query.order_by(Category.name.asc())

        if since_raw:
            since_dt = parse_client_datetime(since_raw)
            q = q.filter(Category.updated_at > since_dt)

        items = [c.to_dict() for c in q.all()]
        return jsonify({"items": items})

    # ----------------------- ANALYSIS / SUMMARY ------------------------------

    @app.route("/api/analytics/summary", methods=["GET"])
    def analytics_summary():
        """High-level summary for dashboard / Analysis tab."""
        range_key = request.args.get("range", "month")
        start_date, end_date = get_time_range(
            range_key,
            start_str=request.args.get("start_date"),
            end_str=request.args.get("end_date"),
        )

        query = apply_date_filter(active_transactions_query(), start_date, end_date)

        total_expense = 0.0
        total_income = 0.0

        by_category: dict[int, dict] = {}
        by_account: dict[int, dict] = {}

        for tx in query.all():
            amount = float(tx.amount)
            is_expense = tx.type == "expense"

            if is_expense:
                total_expense += amount
            else:
                total_income += amount

            # by category
            cat_key = tx.category_id or 0
            if cat_key not in by_category:
                by_category[cat_key] = {
                    "category_id": tx.category_id,
                    "category_name": tx.category.name if tx.category else "Uncategorized",
                    "expense": 0.0,
                    "income": 0.0,
                }
            by_category[cat_key]["expense" if is_expense else "income"] += amount

            # by account
            acc_key = tx.account_id or 0
            if acc_key not in by_account:
                by_account[acc_key] = {
                    "account_id": tx.account_id,
                    "account_name": tx.account.name if tx.account else "Unassigned",
                    "expense": 0.0,
                    "income": 0.0,
                }
            by_account[acc_key]["expense" if is_expense else "income"] += amount

        net = total_income - total_expense

        return jsonify(
            {
                "range": range_key,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "total_expense": total_expense,
                "total_income": total_income,
                "net": net,
                "by_category": list(by_category.values()),
                "by_account": list(by_account.values()),
            }
        )

    # ----------------------- ACCOUNTS ---------------------------------------

    @app.route("/api/accounts", methods=["GET"])
    def list_accounts():
        """
        Optional query param:
          - range: day/week/month/3months/6months/all
        Used to compute "expense so far" and "income so far" totals per account.
        """
        range_key = request.args.get("range", "all")
        start_date, end_date = get_time_range(
            range_key,
            start_str=request.args.get("start_date"),
            end_str=request.args.get("end_date"),
        )

        accounts = active_accounts_query().order_by(Account.name.asc()).all()

        # Precompute totals per account
        totals = {a.id: {"expense": 0.0, "income": 0.0} for a in accounts}

        tx_query = apply_date_filter(active_transactions_query(), start_date, end_date)
        for tx in tx_query.all():
            if tx.account_id in totals:
                key = "expense" if tx.type == "expense" else "income"
                totals[tx.account_id][key] += float(tx.amount)

        result = [acc.to_dict(range_totals=totals.get(acc.id)) for acc in accounts]
        return jsonify(
            {
                "range": range_key,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "items": result,
            }
        )

    @app.route("/api/accounts", methods=["POST"])
    def create_account():
        data = request.get_json(silent=True) or {}
        acc = Account(
            name=data.get("name"),
            type=data.get("type", "cash"),
            initial_balance=data.get("initial_balance", 0),
            updated_at=datetime.utcnow(),
        )
        db.session.add(acc)
        db.session.commit()
        return jsonify(acc.to_dict()), 201

    @app.route("/api/accounts/<int:acc_id>", methods=["PUT", "PATCH"])
    def update_account(acc_id):
        acc = Account.query.get_or_404(acc_id)
        data = request.get_json(silent=True) or {}

        if "name" in data:
            acc.name = data["name"]
        if "type" in data:
            acc.type = data["type"]
        if "initial_balance" in data:
            acc.initial_balance = data["initial_balance"]

        acc.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(acc.to_dict())

    @app.route("/api/accounts/<int:acc_id>", methods=["DELETE"])
    def delete_account(acc_id):
        acc = Account.query.get_or_404(acc_id)
        acc.is_deleted = True
        acc.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"status": "deleted", "id": acc_id})

    # ----------------------- CATEGORIES -------------------------------------

    @app.route("/api/categories", methods=["GET"])
    def list_categories():
        """
        Optional query param:
          - range: day/week/month/3months/6months/all
        Used to calculate expense/income totals per category.
        """
        range_key = request.args.get("range", "all")
        start_date, end_date = get_time_range(
            range_key,
            start_str=request.args.get("start_date"),
            end_str=request.args.get("end_date"),
        )

        categories = active_categories_query().order_by(Category.name.asc()).all()
        totals = {c.id: {"expense": 0.0, "income": 0.0} for c in categories}

        tx_query = apply_date_filter(active_transactions_query(), start_date, end_date)
        for tx in tx_query.all():
            if tx.category_id in totals:
                key = "expense" if tx.type == "expense" else "income"
                totals[tx.category_id][key] += float(tx.amount)

        result = [cat.to_dict(range_totals=totals.get(cat.id)) for cat in categories]
        return jsonify(
            {
                "range": range_key,
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None,
                "items": result,
            }
        )

    @app.route("/api/categories", methods=["POST"])
    def create_category():
        data = request.get_json(silent=True) or {}
        cat = Category(
            name=data.get("name"),
            type=data.get("type", "expense"),
            updated_at=datetime.utcnow(),
        )
        db.session.add(cat)
        db.session.commit()
        return jsonify(cat.to_dict()), 201

    @app.route("/api/categories/<int:cat_id>", methods=["PUT", "PATCH"])
    def update_category(cat_id):
        cat = Category.query.get_or_404(cat_id)
        data = request.get_json(silent=True) or {}

        if "name" in data:
            cat.name = data["name"]
        if data.get("type") in ("expense", "income"):
            cat.type = data["type"]

        cat.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify(cat.to_dict())

    @app.route("/api/categories/<int:cat_id>", methods=["DELETE"])
    def delete_category(cat_id):
        cat = Category.query.get_or_404(cat_id)
        cat.is_deleted = True
        cat.updated_at = datetime.utcnow()
        db.session.commit()
        return jsonify({"status": "deleted", "id": cat_id})

    # ----------------------- BUDGETS ----------------------------------------

    @app.route("/api/budgets", methods=["GET"])
    def list_budgets():
        """List budgets + computed spent amount in their timeframe."""
        budgets = Budget.query.all()

        items = []
        for b in budgets:
            tx_query = active_transactions_query().filter_by(type="expense")
            if b.category_id:
                tx_query = tx_query.filter_by(category_id=b.category_id)
            if b.start_date:
                tx_query = tx_query.filter(Transaction.date >= b.start_date)
            if b.end_date:
                tx_query = tx_query.filter(Transaction.date <= b.end_date)

            spent = sum(float(tx.amount) for tx in tx_query.all())
            items.append(b.to_dict(spent=spent))

        return jsonify({"items": items})

    @app.route("/api/budgets", methods=["POST"])
    def create_budget():
        data = request.get_json(silent=True) or {}

        start = parse_date(data.get("start_date"), None)
        end = parse_date(data.get("end_date"), None)

        b = Budget(
            name=data.get("name"),
            amount=data.get("amount", 0),
            period=data.get("period", "monthly"),
            start_date=start,
            end_date=end,
            category_id=data.get("category_id"),
        )

        db.session.add(b)
        db.session.commit()
        return jsonify(b.to_dict(spent=0.0)), 201

    @app.route("/api/budgets/<int:budget_id>", methods=["PUT", "PATCH"])
    def update_budget(budget_id):
        b = Budget.query.get_or_404(budget_id)
        data = request.get_json(silent=True) or {}

        if "name" in data:
            b.name = data["name"]
        if "amount" in data:
            b.amount = data["amount"]
        if "period" in data:
            b.period = data["period"]
        if "start_date" in data:
            b.start_date = parse_date(data["start_date"], b.start_date)
        if "end_date" in data:
            b.end_date = parse_date(data["end_date"], b.end_date)
        if "category_id" in data:
            b.category_id = data["category_id"]

        db.session.commit()

        # Recompute spent
        tx_query = active_transactions_query().filter_by(type="expense")
        if b.category_id:
            tx_query = tx_query.filter_by(category_id=b.category_id)
        if b.start_date:
            tx_query = tx_query.filter(Transaction.date >= b.start_date)
        if b.end_date:
            tx_query = tx_query.filter(Transaction.date <= b.end_date)

        spent = sum(float(tx.amount) for tx in tx_query.all())
        return jsonify(b.to_dict(spent=spent))

    @app.route("/api/budgets/<int:budget_id>", methods=["DELETE"])
    def delete_budget(budget_id):
        b = Budget.query.get_or_404(budget_id)
        db.session.delete(b)
        db.session.commit()
        return jsonify({"status": "deleted", "id": budget_id})

    # ----------------------- SYNC: TRANSACTIONS ----------------------------

    @app.route("/api/sync/transactions", methods=["POST"])
    def sync_transactions_upload():
        payload = request.get_json(silent=True) or {}
        items = payload.get("items", [])

        for item in items:
            uuid_val = item.get("uuid")
            if not uuid_val:
                continue

            client_updated = parse_client_datetime(item.get("updated_at"))

            # UUID-first inputs
            cat_uuid = item.get("category_uuid")
            acc_uuid = item.get("account_uuid")

            # Backward compat: UUIDs accidentally sent in *_id fields
            raw_cat = item.get("category_id")
            raw_acc = item.get("account_id")

            if not cat_uuid and isinstance(raw_cat, str) and raw_cat and not raw_cat.isdigit():
                cat_uuid = raw_cat
            if not acc_uuid and isinstance(raw_acc, str) and raw_acc and not raw_acc.isdigit():
                acc_uuid = raw_acc

            # Resolve UUID -> numeric FK
            cat_id = resolve_fk_id_from_uuid(Category, cat_uuid) if cat_uuid else None
            acc_id = resolve_fk_id_from_uuid(Account, acc_uuid) if acc_uuid else None

            existing = Transaction.query.filter_by(uuid=uuid_val).first()

            if existing:
                if client_updated > (existing.updated_at or datetime.min):
                    existing.type = item.get("type", existing.type)
                    existing.amount = item.get("amount", existing.amount)
                    existing.date = parse_date(item.get("date"), existing.date)
                    existing.description = item.get("description", existing.description)

                    # apply resolved IDs (or fall back to numeric if provided)
                    if cat_uuid is not None:
                        existing.category_id = cat_id
                    elif raw_cat is not None and not (isinstance(raw_cat, str) and raw_cat and not raw_cat.isdigit()):
                        existing.category_id = raw_cat

                    if acc_uuid is not None:
                        existing.account_id = acc_id
                    elif raw_acc is not None and not (isinstance(raw_acc, str) and raw_acc and not raw_acc.isdigit()):
                        existing.account_id = raw_acc

                    existing.is_deleted = item.get("is_deleted", existing.is_deleted)
                    existing.updated_at = client_updated

            else:
                tx = Transaction(
                    uuid=uuid_val,
                    type=item.get("type", "expense"),
                    amount=item.get("amount", 0),
                    date=parse_date(item.get("date"), date.today()),
                    description=item.get("description"),
                    category_id=cat_id,
                    account_id=acc_id,
                    is_deleted=item.get("is_deleted", False),
                    updated_at=client_updated,
                )
                db.session.add(tx)

        db.session.commit()
        return jsonify({"status": "ok"})


    @app.route("/api/sync/transactions", methods=["GET"])
    def sync_transactions_download():
        """
        Download server-side changes since a timestamp.
        """
        since_raw = request.args.get("since")
        q = Transaction.query

        if since_raw:
            since_dt = parse_client_datetime(since_raw)
            q = q.filter(Transaction.updated_at > since_dt)

        items = [t.to_dict() for t in q.all()]
        return jsonify({"items": items})


# -----------------------------------------------------------------------------
# Entry Point
# -----------------------------------------------------------------------------

app = create_app()

if __name__ == "__main__":
    # For hackathon/dev usage
    app.run(debug=True, host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
