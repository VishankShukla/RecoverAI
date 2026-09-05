require('dotenv').config();
const connectDB = require('../config/database');
const Transaction = require('../models/transaction.model');

const NAMES = ["Ananya Rao", "Rohit Sharma", "Priya Nair", "Karan Mehta", "Sneha Iyer",
    "Aditya Verma", "Fatima Sheikh", "Vikram Singh", "Neha Gupta", "Arjun Das",
    "Divya Menon", "Sameer Khan", "Pooja Reddy", "Rahul Joshi", "Ishita Kapoor"];

const METHODS = ["upi", "card", "netbanking", "wallet"];

// Realistic-ish raw gateway failure strings — the LLM has to interpret these, not just pattern-match a keyword.
const FAILURE_TEMPLATES = [
    "BAD_REQUEST_ERROR: Payment failed due to insufficient funds in account",
    "GATEWAY_ERROR: Card declined by issuing bank, reason code 51",
    "SERVER_ERROR: Payment failed because bank server was down or slow to respond",
    "BAD_REQUEST_ERROR: Payment failed due to OTP not entered within time limit",
    "NETWORK_ERROR: Customer's connection dropped mid-transaction",
    "GATEWAY_ERROR: Card expired",
    "BAD_REQUEST_ERROR: Incorrect CVV entered thrice",
    "USER_DROP: checkout session expired, no payment attempt made",
    "USER_DROP: cart created but checkout never initiated after 20 minutes",
    "GATEWAY_ERROR: Bank declined - suspected fraud, requires manual verification",
];

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomAmount() { return Math.floor(Math.random() * 9000) + 200; }

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

async function generate() {
    await connectDB();
    await Transaction.deleteMany({});

    const docs = [];

    for (let i = 1; i <= 42; i++) {
        const failureText = pick(FAILURE_TEMPLATES);
        docs.push({
            transactionId: `TXN${1000 + i}`,
            customerName: pick(NAMES),
            customerEmail: `customer${i}@example.com`,
            amount: randomAmount(),
            method: pick(METHODS),
            failureReasonRaw: failureText,
            eventType: failureText.startsWith("USER_DROP") ? "checkout_abandoned" : "payment_failed",
            occurredAt: daysAgo(Math.floor(Math.random() * 45)), // some intentionally older than 30-day guardrail
        });
    }


    docs.push(
        { transactionId: "TXN2001", customerName: "Manoj Tiwari", customerEmail: "manoj@example.com", amount: -450, method: "card", failureReasonRaw: "GATEWAY_ERROR: Card declined", occurredAt: daysAgo(2) }, // negative amount
        { transactionId: "TXN2002", customerName: "", customerEmail: "", amount: 1200, method: "upi", failureReasonRaw: "", occurredAt: daysAgo(1) }, // missing name/email/reason
        { transactionId: "TXN2003", customerName: "Late Fellow", customerEmail: "late@example.com", amount: 3000, method: "card", failureReasonRaw: "GATEWAY_ERROR: Card declined", occurredAt: daysAgo(90) }, // too old for guardrail
        { transactionId: "TXN2004", customerName: "Zero Amount", customerEmail: "zero@example.com", amount: 0, method: "upi", failureReasonRaw: "USER_DROP: checkout abandoned", occurredAt: daysAgo(3) }, // zero amount
        { transactionId: "TXN2005", customerName: "Huge Ticket", customerEmail: "huge@example.com", amount: 480000, method: "netbanking", failureReasonRaw: "SERVER_ERROR: bank server timeout", occurredAt: daysAgo(1) }, // very high value, should escalate not auto-retry
        { transactionId: "TXN2006", customerName: undefined, customerEmail: "noname@example.com", amount: 899, method: "wallet", failureReasonRaw: "BAD_REQUEST_ERROR: unknown gateway response §§corrupt##", occurredAt: daysAgo(5) }, // garbled failure text
        { transactionId: "TXN2007", customerName: "Duplicate Sam", customerEmail: "sam@example.com", amount: 1500, method: "card", failureReasonRaw: "GATEWAY_ERROR: Card declined", retryCount: 1, occurredAt: daysAgo(4) }, // already retried once — guardrail should block a second retry
        { transactionId: "TXN2008", customerName: "No Method", customerEmail: "nomethod@example.com", amount: 750, method: "", failureReasonRaw: "USER_DROP: session expired", occurredAt: daysAgo(6) } // missing method
    );

    await Transaction.insertMany(docs);
    console.log(`Seeded ${docs.length} transactions (${docs.length - 8} clean, 8 intentionally malformed/edge-case).`);
    process.exit(0);
}

generate().catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
});
