from datetime import date, datetime
import math
import os

from flask import Flask, jsonify, redirect, render_template, request, url_for
from flask_login import (LoginManager, UserMixin, current_user, login_required,
                         login_user, logout_user)
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text
from werkzeug.security import check_password_hash, generate_password_hash


app = Flask(__name__)
app.config["SECRET_KEY"] = os.environ.get("TAILOR_SECRET_KEY", "change-this-secret-key")
app.config["SQLALCHEMY_DATABASE_URI"] = "sqlite:///tailor.db"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
db = SQLAlchemy(app)

login_manager = LoginManager(app)
login_manager.login_view = "login"
ORDER_STATUSES = {"Received", "In Progress", "Ready", "Delivered"}
PAYMENT_METHODS = {"Cash", "UPI", "Card"}


class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False, index=True)
    password = db.Column(db.String(255), nullable=False)


class Student(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), unique=True, nullable=False)
    batch = db.Column(db.String(20), nullable=False)
    admission_date = db.Column(db.Date, nullable=False)


class Customer(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False, unique=True)
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    orders = db.relationship("Order", back_populates="customer_record")
    measurements = db.relationship("Measurement", back_populates="customer", uselist=False,
                                   cascade="all, delete-orphan")


class Measurement(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer_id = db.Column(db.Integer, db.ForeignKey("customer.id"), nullable=False, unique=True, index=True)
    chest = db.Column(db.Float, nullable=True)
    waist = db.Column(db.Float, nullable=True)
    hip = db.Column(db.Float, nullable=True)
    shoulder = db.Column(db.Float, nullable=True)
    sleeve = db.Column(db.Float, nullable=True)
    length = db.Column(db.Float, nullable=True)
    notes = db.Column(db.Text, nullable=False, default="")
    updated_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    customer = db.relationship("Customer", back_populates="measurements")


class Order(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    customer = db.Column(db.String(100), nullable=False)
    phone = db.Column(db.String(20), nullable=False, default="")
    garment = db.Column(db.String(50), nullable=False)
    order_date = db.Column(db.Date, nullable=False)
    delivery_date = db.Column(db.Date, nullable=False)
    amount = db.Column(db.Float, nullable=False)
    payment = db.Column(db.String(20), nullable=False, default="Unpaid")
    status = db.Column(db.String(20), nullable=False, default="Received")
    customer_id = db.Column(db.Integer, db.ForeignKey("customer.id"), nullable=True)
    customer_record = db.relationship("Customer", back_populates="orders")
    payments = db.relationship("Payment", back_populates="order_record", cascade="all, delete-orphan")


class Payment(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    order_id = db.Column(db.Integer, db.ForeignKey("order.id"), nullable=False, index=True)
    amount = db.Column(db.Float, nullable=False)
    payment_method = db.Column(db.String(20), nullable=False, default="Cash")
    # Retained for compatibility with the original tailor.db payment table.
    method = db.Column(db.String(30), nullable=False, default="Cash")
    payment_date = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    order_record = db.relationship("Order", back_populates="payments")


@login_manager.user_loader
def load_user(user_id):
    return db.session.get(User, int(user_id))


def parse_date(value, label):
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (TypeError, ValueError):
        raise ValueError(f"Enter a valid {label}.")


def paid_total(order):
    return round(sum(payment.amount for payment in order.payments), 2)


def payment_status(order):
    paid = paid_total(order)
    if paid >= order.amount:
        return "Paid"
    return "Partial" if paid > 0 else "Unpaid"


def update_measurements(customer, form):
    values = {}
    for field in ("chest", "waist", "hip", "shoulder", "sleeve", "length"):
        raw_value = form.get(f"measurement_{field}", "").strip()
        if not raw_value:
            values[field] = None
            continue
        value = float(raw_value)
        if not math.isfinite(value) or value <= 0:
            raise ValueError("Measurements must be greater than zero.")
        values[field] = value

    notes = form.get("measurement_notes", "").strip()
    if not any(value is not None for value in values.values()) and not notes:
        return
    measurement = customer.measurements or Measurement(customer=customer)
    for field, value in values.items():
        setattr(measurement, field, value)
    measurement.notes = notes
    db.session.add(measurement)


def measurement_json(customer):
    measurement = customer.measurements if customer else None
    if not measurement:
        return {}
    return {field: getattr(measurement, field) for field in
            ("chest", "waist", "hip", "shoulder", "sleeve", "length", "notes")}


def order_json(order):
    paid = paid_total(order)
    order.payment = payment_status(order)
    return {
        "id": order.id, "customer": order.customer, "phone": order.phone,
        "garment": order.garment, "orderDate": order.order_date.isoformat(),
        "deliveryDate": order.delivery_date.isoformat(), "amount": order.amount,
        "payment": order.payment, "paid": paid, "initialPayment": paid,
        "balance": round(max(0, order.amount - paid), 2), "status": order.status,
        "measurements": measurement_json(order.customer_record),
    }


@app.route("/")
def main():
    return redirect(url_for("home")) if current_user.is_authenticated else render_template("main.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("home"))
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        user = User.query.filter_by(email=email).first()
        if user and check_password_hash(user.password, password):
            login_user(user)
            return redirect(request.args.get("next") or url_for("home"))
        return render_template("login.html", error="Invalid email or password")
    return render_template("login.html")


@app.route("/createacc", methods=["GET", "POST"])
def create_account():
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        if not username or not email or len(password) < 8:
            return render_template("createacc.html", error="Enter your name and email, and use a password of at least 8 characters.")
        if User.query.filter_by(email=email).first():
            return render_template("createacc.html", error="An account with that email already exists.")
        user = User(username=username, email=email, password=generate_password_hash(password))
        db.session.add(user)
        db.session.commit()
        login_user(user)
        return redirect(url_for("home"))
    return render_template("createacc.html")


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))


@app.route("/add_student", methods=["POST"])
@login_required
def add_student():
    try:
        name = request.form.get("name", "").strip()
        phone = request.form.get("phone", "").strip()
        batch = request.form.get("batch", "").strip().lower()
        if not name or not phone or batch not in {"morning", "evening"}:
            raise ValueError("Enter a name, phone, and valid batch.")
        student = Student(name=name, phone=phone, batch=batch,
                          admission_date=parse_date(request.form.get("admission_date"), "admission date"))
        db.session.add(student)
        db.session.commit()
    except ValueError as exc:
        db.session.rollback()
        return str(exc), 400
    except Exception:
        db.session.rollback()
        app.logger.exception("Could not add student")
        return "A student with this phone number may already exist.", 400
    return redirect(url_for("batch"))


@app.route("/edit_student/<int:student_id>", methods=["POST"])
@login_required
def edit_student(student_id):
    student = db.get_or_404(Student, student_id)
    try:
        student.name = request.form.get("name", "").strip()
        student.phone = request.form.get("phone", "").strip()
        student.admission_date = parse_date(request.form.get("admission_date"), "admission date")
        if not student.name or not student.phone:
            raise ValueError("Name and phone are required.")
        db.session.commit()
        return jsonify(success=True)
    except Exception as exc:
        db.session.rollback()
        return jsonify(success=False, error=str(exc) if isinstance(exc, ValueError) else "Phone number already exists."), 400


@app.route("/delete_student/<int:student_id>", methods=["POST"])
@login_required
def delete_student(student_id):
    db.session.delete(db.get_or_404(Student, student_id))
    db.session.commit()
    return jsonify(success=True)


@app.route("/add_order", methods=["POST"])
@login_required
def add_order():
    try:
        name = request.form.get("customer", "").strip()
        phone = request.form.get("phone", "").strip()
        amount = float(request.form.get("amount", ""))
        order_date = parse_date(request.form.get("order_date"), "order date")
        delivery_date = parse_date(request.form.get("delivery_date"), "delivery date")
        garment = request.form.get("garment", "").strip()
        if not name or not garment or not math.isfinite(amount) or amount <= 0:
            raise ValueError("Enter a customer, garment, and amount greater than zero.")
        if delivery_date < order_date:
            raise ValueError("Delivery date cannot be before the order date.")
        customer = Customer.query.filter_by(phone=phone).first() if phone else None
        if customer:
            customer.name = name
        elif phone:
            customer = Customer(name=name, phone=phone)
            db.session.add(customer)
        if customer:
            update_measurements(customer, request.form)
        order = Order(customer=name, phone=phone or "Not added", customer_record=customer,
                      garment=garment, order_date=order_date, delivery_date=delivery_date,
                      amount=amount, payment="Unpaid", status="Received")
        db.session.add(order)
        db.session.flush()
        initial_paid = float(request.form.get("initial_payment", "0") or 0)
        if initial_paid < 0 or initial_paid > amount:
            raise ValueError("Initial payment must be between zero and the order total.")
        if initial_paid:
            method = request.form.get("payment_method", "Cash")
            if method not in PAYMENT_METHODS:
                raise ValueError("Choose a valid payment method.")
            db.session.add(Payment(order_id=order.id, amount=initial_paid,
                                   payment_method=method, method=method))
            order.payment = "Paid" if initial_paid == amount else "Partial"
        requested_status = request.form.get("status", "Received")
        if requested_status not in ORDER_STATUSES:
            raise ValueError("Choose a valid order status.")
        order.status = requested_status
        db.session.commit()
    except (ValueError, TypeError) as exc:
        db.session.rollback()
        return str(exc), 400
    except Exception:
        db.session.rollback()
        app.logger.exception("Could not save order/customer")
        return "Could not save this order. Check the customer phone number and try again.", 400
    return redirect(url_for("order"))


@app.route("/edit_order/<int:order_id>", methods=["POST"])
@login_required
def edit_order(order_id):
    order = db.get_or_404(Order, order_id)
    try:
        name = request.form.get("customer", "").strip()
        phone = request.form.get("phone", order.phone).strip()
        amount = float(request.form.get("amount", ""))
        order_date = parse_date(request.form.get("order_date"), "order date")
        delivery_date = parse_date(request.form.get("delivery_date"), "delivery date")
        if not name or not math.isfinite(amount) or amount <= 0 or delivery_date < order_date:
            raise ValueError("Check the customer, amount, and order dates.")
        paid = paid_total(order)
        initial_paid = float(request.form.get("initial_payment", paid) or 0)
        if not math.isfinite(initial_paid) or initial_paid < 0 or initial_paid > amount:
            raise ValueError("Initial payment must be between zero and the order total.")
        order.customer, order.phone = name, phone or "Not added"
        order.garment = request.form.get("garment", order.garment).strip()
        order.order_date, order.delivery_date = order_date, delivery_date
        order.amount = amount
        difference = round(initial_paid - paid, 2)
        if difference > 0:
            method = request.form.get("payment_method", "Cash")
            if method not in PAYMENT_METHODS:
                raise ValueError("Choose a valid payment method.")
            db.session.add(Payment(order_record=order, amount=difference,
                                   payment_method=method, method=method))
        elif difference < 0:
            remaining = -difference
            for payment in sorted(order.payments, key=lambda item: (item.payment_date, item.id), reverse=True):
                reduction = min(payment.amount, remaining)
                payment.amount = round(payment.amount - reduction, 2)
                remaining = round(remaining - reduction, 2)
                if payment.amount == 0:
                    db.session.delete(payment)
                if remaining == 0:
                    break
        requested_status = request.form.get("status", order.status)
        if requested_status not in ORDER_STATUSES:
            raise ValueError("Choose a valid order status.")
        order.status = requested_status
        if phone:
            customer = Customer.query.filter_by(phone=phone).first()
            if not customer:
                customer = Customer(name=name, phone=phone)
                db.session.add(customer)
            else:
                customer.name = name
            order.customer_record = customer
            update_measurements(customer, request.form)
        db.session.commit()
        return jsonify(success=True, order=order_json(order))
    except Exception as exc:
        db.session.rollback()
        return jsonify(success=False, error=str(exc) if isinstance(exc, ValueError) else "Could not update this order."), 400


@app.route("/delete_order/<int:order_id>", methods=["POST"])
@login_required
def delete_order(order_id):
    db.session.delete(db.get_or_404(Order, order_id))
    db.session.commit()
    return jsonify(success=True)


@app.route("/order")
@login_required
def order():
    return render_template("order.html", orders=[order_json(item) for item in Order.query.order_by(Order.id.desc()).all()])


@app.route("/api/customers/measurements")
@login_required
def customer_measurements():
    phone = request.args.get("phone", "").strip()
    if not phone:
        return jsonify(measurements={})
    customer = Customer.query.filter_by(phone=phone).first()
    return jsonify(measurements=measurement_json(customer))


@app.route("/batch")
@login_required
def batch():
    students = Student.query.order_by(Student.name).all()
    data = [{"id": s.id, "name": s.name, "phone": s.phone,
             "admissionDate": s.admission_date.isoformat(), "batch": s.batch} for s in students]
    return render_template("batch.html", students=data)


@app.route("/billing")
@login_required
def billing():
    return render_template("billing.html", orders=[order_json(item) for item in Order.query.order_by(Order.id.desc()).all()])


@app.route("/api/orders/<int:order_id>/payments", methods=["POST"])
@login_required
def add_payment(order_id):
    order = db.session.get(Order, order_id)
    if order is None:
        return jsonify(error="Order not found"), 404
    data = request.get_json(silent=True) or {}
    try:
        amount = float(data.get("amount", 0))
    except (TypeError, ValueError):
        return jsonify(error="Enter a valid amount"), 400
    if not math.isfinite(amount) or amount <= 0:
        return jsonify(error="Amount must be greater than zero"), 400
    if amount > round(order.amount - paid_total(order), 2):
        return jsonify(error="Payment exceeds the remaining balance."), 400
    method = str(data.get("payment_method", "Cash")).strip()
    if method not in PAYMENT_METHODS:
        return jsonify(error="Choose Cash, UPI, or Card."), 400
    db.session.add(Payment(order_id=order.id, amount=amount, payment_method=method, method=method))
    updated_paid = round(paid_total(order) + amount, 2)
    order.payment = "Paid" if updated_paid >= order.amount else "Partial"
    db.session.commit()
    return jsonify(message="Payment recorded", order=order_json(order)), 201


@app.route("/report")
@login_required
def report():
    data = [order_json(item) for item in Order.query.order_by(Order.id.desc()).all()]
    students = Student.query.order_by(Student.name).all()
    return render_template("report.html", orders=data,
                           students=[{"id": s.id, "name": s.name, "admissionDate": s.admission_date.isoformat(),
                                      "batch": s.batch} for s in students],
                           student_counts={"morning": sum(s.batch == "morning" for s in students),
                                           "evening": sum(s.batch == "evening" for s in students)})


@app.route("/home")
@login_required
def home():
    orders = Order.query.all()
    students = Student.query.all()
    pending_orders = [o for o in orders if o.status not in {"Ready", "Delivered"}]
    due_today = sum(o.delivery_date == date.today() for o in pending_orders)
    balance = sum(max(0, o.amount - paid_total(o)) for o in orders)
    return render_template("home.html", pending_count=len(pending_orders), due_today=due_today,
                           student_count=len(students), pending_balance=balance,
                           batch_count=len({s.batch for s in students}), today=date.today())


def initialize_database():
    """Create missing tables and add compatible columns without replacing existing data."""
    db.create_all()
    with db.engine.begin() as connection:
        inspector = inspect(db.engine)
        order_columns = {column["name"] for column in inspector.get_columns("order")}
        if "status" not in order_columns:
            connection.execute(text("ALTER TABLE \"order\" ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'Received'"))
        if "customer_id" not in order_columns:
            connection.execute(text("ALTER TABLE \"order\" ADD COLUMN customer_id INTEGER REFERENCES customer(id)"))
        payment_columns = {column["name"] for column in inspector.get_columns("payment")}
        if "payment_method" not in payment_columns:
            connection.execute(text("ALTER TABLE payment ADD COLUMN payment_method VARCHAR(20) NOT NULL DEFAULT 'Cash'"))
        if "method" not in payment_columns:
            connection.execute(text("ALTER TABLE payment ADD COLUMN method VARCHAR(30) NOT NULL DEFAULT 'Cash'"))
        # Keep the historical payment label, but seed accurate payment records only when none exist.
        connection.execute(text("UPDATE \"order\" SET status='Received' WHERE status IS NULL OR status=''"))
        connection.execute(text("UPDATE \"order\" SET payment='Unpaid' WHERE payment IS NULL OR payment=''"))
        connection.execute(text("INSERT OR IGNORE INTO customer (name, phone, created_at) SELECT customer, phone, CURRENT_TIMESTAMP FROM \"order\" WHERE phone IS NOT NULL AND phone != '' AND phone != 'Not added'"))
        connection.execute(text("UPDATE \"order\" SET customer_id=(SELECT id FROM customer WHERE customer.phone=\"order\".phone) WHERE customer_id IS NULL AND phone IS NOT NULL AND phone != '' AND phone != 'Not added'"))


with app.app_context():
    initialize_database()


if __name__ == "__main__":
    app.run(debug=True, port=8000)
