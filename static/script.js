/* =========================================================
   TAILORPRO MANAGEMENT APP
   BATCH + ORDERS + BILLING + REPORTS
========================================================= */


/* =========================================================
   HELPER
========================================================= */

function $(id) {
    return document.getElementById(id);
}

function money(value) {
    return "₹" + Number(value || 0).toLocaleString("en-IN");
}

function formatDate(date) {
    if (!date) return "-";

    const d = new Date(date);

    if (isNaN(d.getTime())) {
        return date;
    }

    return d.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function getInitials(name) {
    if (!name) return "";

    return name
        .split(" ")
        .map(word => word.charAt(0))
        .join("")
        .substring(0, 2)
        .toUpperCase();
}

function getPaymentClass(payment) {
    return String(payment || "")
        .toLowerCase()
        .replace(/\s+/g, "-");
}

function getStatusClass(status) {
    return String(status || "")
        .toLowerCase()
        .replace(/\s+/g, "-");
}


/* =========================================================
   BATCH DATA
========================================================= */
let batches = {
    morning: {
        name: "Morning Batch",
        time: "10:00 AM – 12:00 PM",
        days: "Monday – Saturday",
        students: []
    },

    evening: {
        name: "Evening Batch",
        time: "4:00 PM – 6:00 PM",
        days: "Monday – Saturday",
        students: []
    }
};
// Load students from the database
if (window.dbStudents) {

    batches.morning.students =
        window.dbStudents.filter(
            student => student.batch === "morning"
        );

    batches.evening.students =
        window.dbStudents.filter(
            student => student.batch === "evening"
        );
}


let selectedBatch = "morning";

let editingStudentId = null;


/* =========================================================
   ORDER DATA
========================================================= */

let orders = window.dbOrders || [];

let editingOrderId = null;


/* =========================================================
   BILLING DATA
========================================================= */

let bills = [];

let editingBillId = null;


/* =========================================================
   MODAL SYSTEM
========================================================= */

/*
   Your HTML uses:

   <div class="modal-overlay" id="GModal">
       <div class="modal" id="studentModal">
       ...
       </div>
   </div>

   Therefore we open BOTH the overlay and modal.
*/

function openModal(modalId) {

    const modal = $(modalId);

    if (!modal) {
        console.error("Modal not found:", modalId);
        return;
    }

    const overlay = modal.closest(".modal-overlay");

    if (overlay) {

        overlay.classList.add("show");

        /*
           These inline styles make the modal work even
           if the CSS doesn't have .modal-overlay.show.
        */

        overlay.style.display = "flex";
        overlay.style.visibility = "visible";
        overlay.style.opacity = "1";
        overlay.style.pointerEvents = "auto";
    }

    modal.classList.add("show");

    modal.style.display = "block";
    modal.style.visibility = "visible";
    modal.style.opacity = "1";
}


/*
   Close ALL modals
*/

function closeModal() {

    document
        .querySelectorAll(".modal-overlay")
        .forEach(overlay => {

            overlay.classList.remove("show");

            overlay.style.display = "none";
            overlay.style.visibility = "hidden";
            overlay.style.opacity = "0";
            overlay.style.pointerEvents = "none";

        });


    document
        .querySelectorAll(".modal")
        .forEach(modal => {

            modal.classList.remove("show");

            modal.style.display = "none";
            modal.style.visibility = "hidden";
            modal.style.opacity = "0";

        });


    editingStudentId = null;
    editingOrderId = null;
    editingBillId = null;
}


/*
   Close aliases
*/

function closeStudentModal() {
    closeModal();
}

function closeOrderModal() {
    closeModal();
}

function closeBillingModal() {
    closeModal();
}


/* =========================================================
   BATCH
========================================================= */

function selectBatch(batchName) {

    if (!batches[batchName]) {
        return;
    }

    selectedBatch = batchName;


    /*
       Update active batch card
    */

    document
        .querySelectorAll(".batch-card")
        .forEach(card => {

            card.classList.remove("selected");
            card.classList.remove("active");

        });


    if (batchName === "morning") {

        const morning = $("morningBatch");

        if (morning) {
            morning.classList.add("selected");
        }

    }


    if (batchName === "evening") {

        const evening = $("eveningBatch");

        if (evening) {
            evening.classList.add("selected");
        }

    }


    /*
       Update heading
    */

    if ($("selectedBatchTitle")) {

        $("selectedBatchTitle").textContent =
            batches[batchName].name;

    }


    if ($("selectedBatchInfo")) {

        $("selectedBatchInfo").textContent =
            batches[batchName].time +
            " • " +
            batches[batchName].days;

    }


    renderStudents();
}


/* =========================================================
   STUDENT TABLE
========================================================= */

function renderStudents() {

    const body = $("studentTableBody");

    if (!body) {
        return;
    }


    const students =
        batches[selectedBatch].students;


    body.innerHTML = "";


    if (students.length === 0) {

        body.innerHTML = `
            <tr>
                <td colspan="4"
                    style="text-align:center;padding:30px;">
                    No students found
                </td>
            </tr>
        `;

        updateCounts();

        return;
    }


    students.forEach(student => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>

                <div class="customer-cell">

                    <div class="customer-avatar">
                        ${getInitials(student.name)}
                    </div>

                    <div>

                        <div class="customer-name">
                            ${student.name}
                        </div>

                    </div>

                </div>

            </td>


            <td>
                ${formatDate(student.admissionDate)}
            </td>


            <td>
                ${student.phone}
            </td>


            <td>

                <div class="actions">

                    <button
                        class="action-btn edit-btn"
                        onclick="editStudent(${student.id})"
                        title="Edit">
                        ✏️
                    </button>


                    <button
                        class="action-btn delete-btn"
                        onclick="deleteStudent(${student.id})"
                        title="Delete">
                        🗑️
                    </button>

                </div>

            </td>

        `;


        body.appendChild(row);

    });


    updateCounts();
}


/* =========================================================
   BATCH COUNTS
========================================================= */

function updateCounts() {

    if ($("morningCount")) {

        $("morningCount").textContent =
            batches.morning.students.length;

    }


    if ($("eveningCount")) {

        $("eveningCount").textContent =
            batches.evening.students.length;

    }
}


/* =========================================================
   ADD STUDENT
========================================================= */

function openAddStudentModal() {

    const form = $("studentForm");

    if (!form) {

        console.error(
            "studentForm not found"
        );

        return;
    }


    editingStudentId = null;


    form.reset();


    if ($("modalTitle")) {

        $("modalTitle").textContent =
            "Add Student";

    }


    if ($("admissionDate")) {

        $("admissionDate").valueAsDate =
            new Date();

    }


    openModal("studentModal");
}


/* =========================================================
   EDIT STUDENT
========================================================= */

function editStudent(id) {

    const student =
        batches[selectedBatch]
            .students
            .find(s => s.id === id);


    if (!student) {
        return;
    }


    editingStudentId = id;


    if ($("modalTitle")) {

        $("modalTitle").textContent =
            "Edit Student";

    }


    if ($("studentName")) {

        $("studentName").value =
            student.name;

    }


    if ($("studentPhone")) {

        $("studentPhone").value =
            student.phone;

    }


    if ($("admissionDate")) {

        $("admissionDate").value =
            student.admissionDate;

    }


    openModal("studentModal");
}


/* =========================================================
   DELETE STUDENT
========================================================= */

function deleteStudent(id) {

    const student =
        batches[selectedBatch]
            .students
            .find(s => s.id === id);

    if (!student) {
        return;
    }

    const confirmed =
        confirm(`Remove ${student.name} from this batch?`);

    if (!confirmed) {
        return;
    }

    fetch(`/delete_student/${id}`, {
        method: "POST"
    })
        .then(response => response.json())
        .then(data => {

            if (result.success) {

                batches[selectedBatch].students =
                    batches[selectedBatch]
                        .students
                        .filter(s => s.id !== id);

                renderStudents();
                updateCounts();

            } else {
                alert("Could not delete student.");
            }

        })
        .catch(error => {
            console.error(error);
            alert("Something went wrong while deleting the student.");
        });
}

/* =========================================================
   STUDENT FORM
========================================================= */

function setupStudentForm() {

    const form = $("studentForm");

    if (!form) {
        return;
    }


    /*
       Prevent duplicate event listeners
    */

    if (form.dataset.ready === "true") {
        return;
    }

    form.dataset.ready = "true";


    form.addEventListener(
        "submit",
        function (event) {

            // Allow a new student to be submitted to Flask
            if (editingStudentId === null) {
                const batchInput = $("studentBatch");

                if (batchInput) {
                    batchInput.value = selectedBatch;
                }

                return;
            }

            event.preventDefault();


            const name =
                $("studentName")?.value
                    .trim() || "";


            const phone =
                $("studentPhone")?.value
                    .trim() || "";


            const admissionDate =
                $("admissionDate")?.value || "";


            if (
                !name ||
                !phone ||
                !admissionDate
            ) {

                alert(
                    "Please fill all student details."
                );

                return;
            }


            /*
               EDIT
            */

            if (editingStudentId !== null) {

                const formData = new URLSearchParams();

                formData.append("name", name);
                formData.append("phone", phone);
                formData.append("admission_date", admissionDate);

                fetch(`/edit_student/${editingStudentId}`, {
                    method: "POST",
                    body: formData
                })
                    .then(response => response.json())
                    .then(data => {

                        if (result.success) {

                            const student =
                                batches[selectedBatch]
                                    .students
                                    .find(
                                        s =>
                                            s.id ===
                                            editingStudentId
                                    );

                            if (student) {
                                student.name = name;
                                student.phone = phone;
                                student.admissionDate = admissionDate;
                            }

                            renderStudents();
                            updateCounts();
                            closeModal();

                        } else {
                            alert("Could not update student.");
                        }

                    })
                    .catch(error => {
                        console.error(error);
                        alert("Something went wrong while updating the student.");
                    });

                return;
            }


            /*
               NEW STUDENT
            */

            else {

                let highestId = 0;


                Object.values(batches)
                    .forEach(batch => {

                        batch.students
                            .forEach(student => {

                                highestId =
                                    Math.max(
                                        highestId,
                                        Number(student.id)
                                    );

                            });

                    });


                batches[selectedBatch]
                    .students
                    .push({

                        id: highestId + 1,

                        name: name,

                        phone: phone,

                        admissionDate:
                            admissionDate

                    });

            }


            renderStudents();

            updateCounts();

            closeModal();

        }
    );
}


/* =========================================================
   ORDERS TABLE
========================================================= */

function renderOrders() {

    const body =
        $("orderTableBody");


    if (!body) {
        return;
    }


    const search =
        ($("searchInput")?.value || "")
            .toLowerCase()
            .trim();


    const statusFilter =
        $("statusFilter")?.value ||
        "all";


    const filteredOrders =
        orders.filter(order => {

            const text =
                `${order.id} ${order.customer} ${order.garment}`
                    .toLowerCase();


            const matchesSearch =
                text.includes(search);


            const matchesStatus =
                statusFilter === "all" ||
                order.status === statusFilter;


            return (
                matchesSearch &&
                matchesStatus
            );

        });


    body.innerHTML = "";


    if (filteredOrders.length === 0) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:40px;
                    ">

                    No orders found

                </td>

            </tr>

        `;


        updateOrderSummary();

        return;
    }


    filteredOrders.forEach(order => {

        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>

                <strong>
                    ${order.id}
                </strong>

                <div
                    style="
                        color:#667085;
                        font-size:10px;
                        margin-top:4px;
                    ">

                    ${formatDate(order.orderDate)}

                </div>

            </td>


            <td>

                <div class="customer-cell">

                    <div class="customer-avatar">
                        ${getInitials(order.customer)}
                    </div>

                    <div>

                        <div class="customer-name">
                            ${order.customer}
                        </div>

                        <div class="customer-phone">
                            ${order.phone || "Not added"}
                        </div>

                    </div>

                </div>

            </td>


            <td>
                ${order.garment}
            </td>


            <td>
                ${formatDate(order.deliveryDate)}
            </td>


            <td>
                ${money(order.amount)}
            </td>


            <td>

                ${money(order.paid ?? order.initialPayment ?? 0)}

            </td>


            <td>

                <span
                    class="status ${getStatusClass(order.status)}">

                    ${order.status}

                </span>

            </td>


            <td>

                <div class="actions">

                    <button
                        class="action-btn view-btn"
                        onclick="viewOrder(${order.id})"
                        title="View">
                        👁️
                    </button>


                    <button
                        class="action-btn edit-btn"
                        onclick="editOrder(${order.id})"
                        title="Edit">
                        ✏️
                    </button>


                    <button
                        class="action-btn delete-btn"
                        onclick="deleteOrder(${order.id})"
                        title="Delete">
                        🗑️
                    </button>

                </div>

            </td>

        `;


        body.appendChild(row);

    });


    updateOrderSummary();
}


/* =========================================================
   ORDER SUMMARY
========================================================= */

function updateOrderSummary() {

    if ($("totalOrders")) {

        $("totalOrders").textContent =
            orders.length;

    }


    if ($("pendingOrders")) {

        $("pendingOrders").textContent =
            orders.filter(
                order =>
                    ![
                        "Ready",
                        "Delivered"
                    ].includes(order.status)
            ).length;

    }


    if ($("readyOrders")) {

        $("readyOrders").textContent =
            orders.filter(
                order =>
                    order.status === "Ready"
            ).length;

    }


    if ($("completedOrders")) {

        $("completedOrders").textContent =
            orders.filter(
                order =>
                    order.status === "Delivered"
            ).length;

    }


    /*
       Some versions of your HTML may use totalRevenue.
    */

    if ($("totalRevenue")) {

        const total =
            orders.reduce(
                (sum, order) =>
                    sum +
                    Number(order.amount || 0),
                0
            );


        $("totalRevenue").textContent =
            money(total);

    }
}


/* =========================================================
   ADD ORDER
========================================================= */

function openAddOrderModal() {

    const form =
        $("Form") ||
        $("orderForm");


    if (!form) {

        console.error(
            "Order form not found."
        );

        return;
    }


    editingOrderId = null;


    form.reset();


    if ($("modalTitle")) {

        $("modalTitle").textContent =
            "New Order";

    }


    if ($("orderDate")) {

        $("orderDate").valueAsDate =
            new Date();

    }


    openModal("orderModal");
}


/* =========================================================
   EDIT ORDER
========================================================= */

function editOrder(id) {

    const order =
        orders.find(
            order =>
                order.id === id
        );


    if (!order) {
        return;
    }


    editingOrderId = id;


    if ($("modalTitle")) {

        $("modalTitle").textContent =
            "Edit Order";

    }


    if ($("customerName")) {

        $("customerName").value =
            order.customer;

    }

    if ($("customerPhone")) {
        $("customerPhone").value = order.phone === "Not added" ? "" : order.phone;
    }


    if ($("garment")) {

        $("garment").value =
            order.garment;

    }


    if ($("orderDate")) {

        $("orderDate").value =
            order.orderDate;

    }


    if ($("deliveryDate")) {

        $("deliveryDate").value =
            order.deliveryDate;

    }


    if ($("amount")) {

        $("amount").value =
            order.amount;

    }

    if ($("initialPayment")) {
        $("initialPayment").value = Number(order.paid ?? order.initialPayment ?? 0);
    }


    if ($("orderStatus")) $("orderStatus").value = order.status || "Received";


    if ($("orderStatus")) {

        $("orderStatus").value =
            order.status;

    }


    openModal("orderModal");
}


/* =========================================================
   ORDER FORM
========================================================= */

function setupOrderForm() {

    /*
       Your actual HTML uses id="Form"
    */

    const form =
        $("Form") ||
        $("orderForm");


    if (!form) {
        return;
    }


    if (form.dataset.ready === "true") {
        return;
    }

    form.dataset.ready = "true";


    form.addEventListener(
        "submit",
        function (event) {

            if (editingOrderId === null) {
                return;
            }

            event.preventDefault();


            const customer =
                $("customerName")?.value
                    .trim() || "";


            const garment =
                $("garment")?.value || "";


            const orderDate =
                $("orderDate")?.value || "";


            const deliveryDate =
                $("deliveryDate")?.value || "";


            const amount =
                Number(
                    $("amount")?.value || 0
                );

            const initialPayment = Number($("initialPayment")?.value || 0);


            const phone = $("customerPhone")?.value.trim() || "";


            /*
               Your current Order HTML does NOT
               have an orderStatus field.

               Therefore new orders use Received.
            */

            const status =
                $("orderStatus")?.value ||
                "Received";


            if (
                !customer ||
                !garment ||
                !orderDate ||
                !deliveryDate ||
                amount <= 0 || initialPayment < 0 || initialPayment > amount
            ) {

                alert(
                    "Please fill all order details."
                );

                return;
            }


            /*
               EDIT ORDER
            */

            if (editingOrderId !== null) {

                const formData = new URLSearchParams();

                formData.append("customer", customer);
                formData.append("garment", garment);
                formData.append("order_date", orderDate);
                formData.append("delivery_date", deliveryDate);
                formData.append("amount", amount);
                formData.append("initial_payment", initialPayment);
                formData.append("payment_method", $("initialPaymentMethod")?.value || "Cash");
                formData.append("phone", phone);
                formData.append("status", $("orderStatus")?.value || "Received");

                fetch(`/edit_order/${editingOrderId}`, {
                    method: "POST",
                    body: formData
                })
                    .then(response => {
                        console.log("Response Status: ",response.status);
                        return response.json();
                    })
                    .then(data => {
                        console.log("server response:",data);
                        const result = data;
                        
                        

                        if (result.success) {

                            const order =
                                orders.find(
                                    order =>
                                        order.id ===
                                        editingOrderId
                                );

                            if (order) {
                                order.customer = customer;
                                order.phone = phone || "Not added";
                                order.garment = garment;
                                order.orderDate = orderDate;
                                order.deliveryDate = deliveryDate;
                                order.amount = amount;
                                order.status = $("orderStatus")?.value || "Received";
                                if (result.order) Object.assign(order, result.order);
                            }

                            renderOrders();
                            renderBilling();
                            generateReport();
                            closeModal();

                        } else {
                            alert("Could not update order.");
                        }

                    })
                    .catch(error => {
                        console.error(error);
                        alert("Something went wrong while updating the order.");
                    });

                return;
            }
            /*
               NEW ORDER
            */

            else {

                let highestNumber = 0;


                orders.forEach(order => {

                    const number =
                        parseInt(
                            order.id.replace(
                                "ORD-",
                                ""
                            ),
                            10
                        );


                    if (!isNaN(number)) {

                        highestNumber =
                            Math.max(
                                highestNumber,
                                number
                            );

                    }

                });


                const newId =
                    "ORD-" +
                    String(
                        highestNumber + 1
                    ).padStart(4, "0");


                orders.unshift({

                    id: newId,

                    customer: customer,

                    phone: "Not added",

                    garment: garment,

                    orderDate:
                        orderDate,

                    deliveryDate:
                        deliveryDate,

                    amount:
                        amount,

                    paid: initialPayment,
                    initialPayment,
                    balance: amount - initialPayment,

                    status:
                        status

                });

            }


            renderOrders();

            renderBilling();

            generateReport();

            closeModal();

        }
    );
}


/* =========================================================
   VIEW ORDER
========================================================= */

function viewOrder(id) {

    const order =
        orders.find(
            order =>
                order.id === id
        );


    if (!order) {
        return;
    }


    alert(

        "Order Details\n\n" +

        "Order ID: " +
        order.id +

        "\nCustomer: " +
        order.customer +

        "\nPhone: " +
        (order.phone || "Not added") +

        "\nGarment: " +
        order.garment +

        "\nOrder Date: " +
        formatDate(order.orderDate) +

        "\nDelivery: " +
        formatDate(order.deliveryDate) +

        "\nAmount: " +
        money(order.amount) +

        "\nPayment: " +
        money(order.paid ?? order.initialPayment ?? 0) +

        "\nStatus: " +
        order.status

    );
}


/* =========================================================
   DELETE ORDER
========================================================= */

function deleteOrder(id) {

    const order = orders.find(
        order => order.id === Number(id)
    );

    if (!order) {
        return;
    }

    const confirmed = confirm(
        `Delete order for ${order.customer}?`
    );

    if (!confirmed) {
        return;
    }

    fetch(`/delete_order/${id}`, {
        method: "POST"
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(
                `Server error: ${response.status}`
            );
        }

        return response.json();
    })
    .then(data => {

        if (data.success) {

            orders = orders.filter(
                order => order.id !== Number(id)
            );

            renderOrders();
            renderBilling();
            generateReport();

        } else {
            alert("Could not delete order.");
        }

    })
    .catch(error => {
        console.error("Delete order error:", error);
        alert("Something went wrong while deleting the order.");
    });
}



/* =========================================================
   BILLING
========================================================= */

function getBills() {
    return orders.map(order => ({
        id: `BILL-${order.id}`, customer: order.customer, orderId: order.id,
        total: Number(order.amount), paid: Number(order.paid || 0),
        balance: Number(order.balance ?? (order.amount - (order.paid || 0))),
        method: order.payment || "Unpaid"
    }));
}


/* =========================================================
   BILL STATUS
========================================================= */

function getBillStatus(bill) {

    if (
        Number(bill.paid) >=
        Number(bill.total)
    ) {

        return "Paid";

    }


    if (
        Number(bill.paid) > 0
    ) {

        return "Partial";

    }


    return "Unpaid";
}


/* =========================================================
   BILLING TABLE
========================================================= */

function renderBilling() {

    const body =
        $("billingTableBody");


    if (!body) {
        return;
    }


    const search =
        ($("billingSearch")?.value || "")
            .toLowerCase()
            .trim();


    const data =
        getBills().filter(bill => {

            const text =
                `${bill.id} ${bill.customer} ${bill.orderId}`
                    .toLowerCase();


            return text.includes(search);

        });


    body.innerHTML = "";


    if (data.length === 0) {

        body.innerHTML = `

            <tr>

                <td
                    colspan="8"
                    style="
                        text-align:center;
                        padding:40px;
                    ">

                    No bills found

                </td>

            </tr>

        `;


        updateBillingSummary();

        return;
    }


    data.forEach(bill => {

        const balance =
            Math.max(
                0,
                Number(bill.total) -
                Number(bill.paid)
            );


        const status =
            getBillStatus(bill);


        const row =
            document.createElement("tr");


        row.innerHTML = `

            <td>
                <strong>
                    ${bill.id}
                </strong>
            </td>


            <td>
                ${bill.customer}
            </td>


            <td>
                ${bill.orderId}
            </td>


            <td>
                ${money(bill.total)}
            </td>


            <td>
                ${money(bill.paid)}
            </td>


            <td>
                ${money(balance)}
            </td>


            <td>

                <span
                    class="${getPaymentClass(status)}">

                    ${status}

                </span>

            </td>


            <td>

                <div class="actions">

                    <button
                        class="action-btn view-btn"
                        onclick="viewBill('${bill.id}')"
                        title="View">
                        👁️
                    </button>


                    <button
                        class="action-btn edit-btn"
                        onclick="editBill('${bill.id}')"
                        title="Edit">
                        ✏️
                    </button>

                </div>

            </td>

        `;


        body.appendChild(row);

    });


    updateBillingSummary();
}


/* =========================================================
   BILLING SUMMARY
========================================================= */

function updateBillingSummary() {

    const data =
        getBills();


    const total =
        data.reduce(
            (sum, bill) =>
                sum +
                Number(bill.total || 0),
            0
        );


    const paid =
        data.reduce(
            (sum, bill) =>
                sum +
                Number(bill.paid || 0),
            0
        );


    const pending =
        Math.max(
            0,
            total - paid
        );


    const completed =
        data.filter(
            bill =>
                getBillStatus(bill) ===
                "Paid"
        ).length;


    if ($("billingTotal")) {

        $("billingTotal").textContent =
            money(total);

    }


    if ($("billingPaid")) {

        $("billingPaid").textContent =
            money(paid);

    }


    if ($("billingPending")) {

        $("billingPending").textContent =
            money(pending);

    }


    if ($("billingCompleted")) {

        $("billingCompleted").textContent =
            completed;

    }
}


/* =========================================================
   ADD BILL
========================================================= */

function openBillingModal() {

    const form =
        $("billingForm");


    if (!form) {

        console.error(
            "billingForm not found"
        );

        return;
    }


    editingBillId = null;


    form.reset();
    syncBillingOrder();


    if ($("modalTitle")) {

        $("modalTitle").textContent =
            "New Bill";

    }


    openModal("billingModal");
}


/*
   Extra name in case your billing HTML
   uses openAddBillingModal()
*/

function openAddBillingModal() {

    openBillingModal();
}


/* =========================================================
   EDIT BILL
========================================================= */

function editBill(id) {

    const bill =
        getBills().find(
            bill =>
                bill.id === id
        );


    if (!bill) {
        return;
    }


    editingBillId = id;


    if ($("modalTitle")) $("modalTitle").textContent = "Record payment";
    if ($("billingOrder")) $("billingOrder").value = bill.orderId;
    if ($("paidAmount")) $("paidAmount").value = "";
    if ($("paymentMethod")) $("paymentMethod").value = "";
    syncBillingOrder();


    openModal("billingModal");
}

function syncBillingOrder() {
    const order = orders.find(item => String(item.id) === String($("billingOrder")?.value));
    if (!order) {
        if ($("billingCustomer")) $("billingCustomer").value = "";
        if ($("billingAmount")) $("billingAmount").value = "";
        return;
    }
    if ($("billingCustomer")) $("billingCustomer").value = order.customer;
    if ($("billingAmount")) $("billingAmount").value = order.amount;
}


/* =========================================================
   VIEW BILL
========================================================= */

function viewBill(id) {

    const bill =
        getBills().find(
            bill =>
                bill.id === id
        );


    if (!bill) {
        return;
    }


    const balance =
        Math.max(
            0,
            Number(bill.total) -
            Number(bill.paid)
        );


    alert(

        "Bill Details\n\n" +

        "Bill ID: " +
        bill.id +

        "\nCustomer: " +
        bill.customer +

        "\nOrder: " +
        bill.orderId +

        "\nTotal: " +
        money(bill.total) +

        "\nPaid: " +
        money(bill.paid) +

        "\nBalance: " +
        money(balance) +

        "\nPayment: " +
        getBillStatus(bill)

    );
}


/* =========================================================
   BILL FORM
========================================================= */

function setupBillingForm() {

    const form =
        $("billingForm");


    if (!form) {
        return;
    }


    if (form.dataset.ready === "true") {
        return;
    }

    form.dataset.ready = "true";


    form.addEventListener(
        "submit",
        function (event) {

            event.preventDefault();


            const orderId =
                $("billingOrder")
                    ?.value
                    .trim() || "";
            const amount =
                Number(
                    $("paidAmount")
                        ?.value || 0
                );


            const method =
                $("paymentMethod")
                    ?.value || "Other";


            if (
                !orderId ||
                amount <= 0
            ) {

                alert(
                    "Please enter valid billing details."
                );

                return;
            }


            fetch(`/api/orders/${orderId}/payments`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ amount, payment_method: method })
            }).then(async response => {
                const data = await response.json();
                if (!response.ok) throw new Error(data.error || "Could not save payment.");
                Object.assign(orders.find(item => String(item.id) === String(orderId)), data.order);
                renderBilling();
                renderOrders();
                generateReport();
                closeModal();
                form.reset();
            }).catch(error => alert(error.message));

        }
    );
}


/* =========================================================
   REPORTS
========================================================= */

function reportDateMatches(value, period, now = new Date()) {
    if (!value) return false;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;
    if (period === "all") return true;
    if (period === "today") return date.toDateString() === new Date(now.getFullYear(), now.getMonth(), now.getDate()).toDateString();
    if (period === "week") {
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
        const end = new Date(start);
        end.setDate(end.getDate() + 7);
        return date >= start && date < end;
    }
    if (period === "month") return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    if (period === "year") return date.getFullYear() === now.getFullYear();
    return true;
}

function generateReport() {

    /*
       Don't run on pages without report elements.
    */

    if (
        !$("reportOrders") &&
        !$("reportTotalOrderCount") &&
        !$("reportPeriod")
    ) {

        return;
    }


    const period =
        $("reportPeriod")?.value ||
        "all";


    const now = new Date();
    const filteredOrders = orders.filter(order => reportDateMatches(order.orderDate, period, now));
    const sourceStudents = window.dbStudents || [];
    const filteredStudents = sourceStudents.filter(student => reportDateMatches(student.admissionDate, period, now));


    const orderValue =
        filteredOrders.reduce(
            (sum, order) =>
                sum +
                Number(order.amount || 0),
            0
        );
    const revenue = filteredOrders.reduce((sum, order) => sum + Number(order.paid || 0), 0);


    const inProgressOrders = filteredOrders.filter(order => ["Received", "In Progress"].includes(order.status));
    const inProgress = inProgressOrders.length;


    const ready =
        filteredOrders.filter(
            order =>
                order.status === "Ready"
        ).length;


    const delivered =
        filteredOrders.filter(
            order =>
                order.status === "Delivered"
        ).length;


    /*
       Main report cards
    */

    if ($("reportOrders")) {

        $("reportOrders").textContent =
            filteredOrders.length;

    }


    if ($("reportRevenue")) {

        $("reportRevenue").textContent =
            money(revenue);

    }


    if ($("reportPending")) {

        $("reportPending").textContent =
            inProgress;

    }


    if ($("reportStudents")) {
        $("reportStudents").textContent = sourceStudents.length
            ? filteredStudents.length
            : (period === "all" ? batches.morning.students.length + batches.evening.students.length : 0);
    }


    /*
       Order statistics
    */

    if ($("reportTotalOrderCount")) {

        $("reportTotalOrderCount")
            .textContent =
            filteredOrders.length;

    }


    if ($("reportTotalOrderAmount")) {

        $("reportTotalOrderAmount")
            .textContent =
            money(orderValue);

    }


    if ($("reportInProgress")) {

        $("reportInProgress")
            .textContent =
            inProgress;

    }
    if ($("reportInProgressAmount")) $("reportInProgressAmount").textContent = money(inProgressOrders.reduce((sum, order) => sum + Number(order.amount || 0), 0));


    if ($("reportReady")) {

        $("reportReady")
            .textContent =
            ready;

    }
    if ($("reportReadyAmount")) $("reportReadyAmount").textContent = money(filteredOrders.filter(order => order.status === "Ready").reduce((sum, order) => sum + Number(order.amount || 0), 0));


    if ($("reportDelivered")) {

        $("reportDelivered")
            .textContent =
            delivered;

    }
    if ($("reportDeliveredAmount")) $("reportDeliveredAmount").textContent = money(filteredOrders.filter(order => order.status === "Delivered").reduce((sum, order) => sum + Number(order.amount || 0), 0));


    /*
       Payment statistics
    */

    const paidOrders = filteredOrders.filter(order => Number(order.paid || 0) >= Number(order.amount || 0));


    const partialOrders =
        filteredOrders.filter(
            order => Number(order.paid || 0) > 0 && Number(order.paid || 0) < Number(order.amount || 0)
        );


    const unpaidOrders =
        filteredOrders.filter(
            order => Number(order.paid || 0) <= 0
        );


    if ($("paidOrderCount")) {

        $("paidOrderCount").textContent =
            paidOrders.length;

    }


    if ($("partialOrderCount")) {

        $("partialOrderCount").textContent =
            partialOrders.length;

    }


    if ($("unpaidOrderCount")) {

        $("unpaidOrderCount").textContent =
            unpaidOrders.length;

    }


    if ($("paidOrderAmount")) {

        $("paidOrderAmount").textContent =
            money(
                paidOrders.reduce(
                    (sum, order) =>
                        sum +
                        Number(order.paid || 0),
                    0
                )
            );

    }


    if ($("partialOrderAmount")) {

        $("partialOrderAmount").textContent =
            money(
                partialOrders.reduce(
                    (sum, order) =>
                        sum +
                        Number(order.paid || 0),
                    0
                )
            );

    }


    if ($("unpaidOrderAmount")) {

        $("unpaidOrderAmount").textContent =
            money(
                unpaidOrders.reduce(
                    (sum, order) =>
                        sum +
                        Number(order.balance ?? order.amount ?? 0),
                    0
                )
            );

    }


    /*
       Batch statistics
    */

    if ($("reportMorningStudents")) $("reportMorningStudents").textContent = sourceStudents.length
        ? filteredStudents.filter(student => student.batch === "morning").length
        : (period === "all" ? batches.morning.students.length : 0);
    if ($("reportEveningStudents")) $("reportEveningStudents").textContent = sourceStudents.length
        ? filteredStudents.filter(student => student.batch === "evening").length
        : (period === "all" ? batches.evening.students.length : 0);

    const detailsBody = $("reportOrderDetails");
    if (detailsBody) {
        detailsBody.replaceChildren();
        if (filteredOrders.length === 0) {
            const row = document.createElement("tr");
            const cell = document.createElement("td");
            cell.colSpan = 8;
            cell.textContent = "No orders in this period";
            row.appendChild(cell);
            detailsBody.appendChild(row);
        } else {
            filteredOrders.forEach(order => {
                const row = document.createElement("tr");
                const values = [order.id, order.customer, order.garment, formatDate(order.orderDate), order.status,
                    money(order.amount), money(order.paid), money(order.balance)];
                values.forEach(value => {
                    const cell = document.createElement("td");
                    cell.textContent = value ?? "";
                    row.appendChild(cell);
                });
                detailsBody.appendChild(row);
            });
        }
    }
}


/* =========================================================
   PRINT REPORT
========================================================= */

function printReport() {

    window.print();
}


/* =========================================================
   SEARCH / FILTERS
========================================================= */

function setupSearchAndFilters() {

    const searchInput =
        $("searchInput");


    if (searchInput) {

        searchInput.addEventListener(
            "input",
            renderOrders
        );

    }


    const statusFilter =
        $("statusFilter");


    if (statusFilter) {

        statusFilter.addEventListener(
            "change",
            renderOrders
        );

    }


    const billingSearch =
        $("billingSearch");


    if (billingSearch) {

        billingSearch.addEventListener(
            "input",
            renderBilling
        );

    }


    const reportPeriod =
        $("reportPeriod");


    if (reportPeriod) {

        reportPeriod.addEventListener(
            "change",
            generateReport
        );

    }
}


/* =========================================================
   MODAL CLICK EVENTS
========================================================= */

function setupModalEvents() {

    document
        .querySelectorAll(".modal-overlay")
        .forEach(overlay => {

            overlay.addEventListener(
                "click",
                function (event) {

                    /*
                       Clicking the dark background closes
                       the modal.
                    */

                    if (
                        event.target ===
                        overlay
                    ) {

                        closeModal();

                    }

                }
            );

        });


    /*
       ESC key closes modal
    */

    document.addEventListener(
        "keydown",
        function (event) {

            if (event.key === "Escape") {

                closeModal();

            }

        }
    );
}


/* =========================================================
   EXPOSE FUNCTIONS TO HTML
========================================================= */

Object.assign(
    window,
    {

        /* General */

        closeModal,
        closeStudentModal,
        closeOrderModal,
        closeBillingModal,
        syncBillingOrder,


        /* Batch */

        selectBatch,
        openAddStudentModal,
        editStudent,
        deleteStudent,


        /* Order */

        openAddOrderModal,
        editOrder,
        viewOrder,
        deleteOrder,
        renderOrders,


        /* Billing */

        openBillingModal,
        openAddBillingModal,
        editBill,
        viewBill,
        renderBilling,


        /* Reports */

        generateReport,
        printReport

    }
);


/* =========================================================
   INITIALIZE APP
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    function () {

        /*
           BATCH
        */

        if ($("studentTableBody")) {

            updateCounts();

            renderStudents();

            setupStudentForm();

        }


        /*
           ORDERS
        */

        if ($("orderTableBody")) {

            renderOrders();

            setupOrderForm();

        }


        /*
           BILLING
        */

        if ($("billingTableBody")) {

            renderBilling();

            setupBillingForm();

        }


        /*
           REPORTS
        */

        generateReport();


        /*
           Common events
        */

        setupSearchAndFilters();

        setupModalEvents();

    }
);
