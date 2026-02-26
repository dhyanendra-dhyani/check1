/**
 * ═══════════════════════════════════════════════════════════
 * SUVIDHA Setu - Mock Data & Constants
 * Contains all hardcoded mock data for demonstration
 * ═══════════════════════════════════════════════════════════
 */

/** Mock bills database */
export const mockBills = [
    {
        id: "PSEB-123456",
        service: "electricity",
        name: "R*** Kumar",
        fullName: "Rajesh Kumar",
        amount: 450,
        units: 85,
        unitLabel: "kWh",
        dueDate: "2026-02-28",
        lastPaymentDate: "2026-01-15",
        address: "H.No. 234, Sector 5, Ludhiana, Punjab",
        meterNo: "MTR-0098765",
    },
    {
        id: "PHED-789012",
        service: "water",
        name: "P*** Singh",
        fullName: "Paramjit Singh",
        amount: 280,
        units: 12,
        unitLabel: "KL",
        dueDate: "2026-03-05",
        lastPaymentDate: "2026-01-20",
        address: "H.No. 567, Model Town, Ludhiana, Punjab",
        meterNo: "WTR-0045678",
    },
    {
        id: "GPL-345678",
        service: "gas",
        name: "S*** Devi",
        fullName: "Sunita Devi",
        amount: 620,
        units: 3,
        unitLabel: "Cylinders",
        dueDate: "2026-03-10",
        lastPaymentDate: "2026-02-01",
        address: "H.No. 89, Civil Lines, Ludhiana, Punjab",
        meterNo: "GAS-0012345",
    },
];

/** Complaint categories (with keywords for voice auto-detect) */
export const complaintCategories = [
    { value: "broken_streetlight", label: "Broken Streetlight", icon: "💡", keywords: ["streetlight", "light", "dark", "lamp", "pole", "bijli", "roshni"] },
    { value: "water_supply", label: "Water Supply Issue", icon: "🚰", keywords: ["water", "supply", "pipe", "leak", "tap", "pani", "paani", "jal"] },
    { value: "garbage_collection", label: "Garbage Collection", icon: "🗑️", keywords: ["garbage", "waste", "trash", "dump", "kachra", "safai", "clean"] },
    { value: "voltage_fluctuation", label: "Voltage Fluctuation", icon: "⚡", keywords: ["voltage", "fluctuation", "power", "electric", "current", "bijli", "volt"] },
    { value: "road_damage", label: "Road Damage / Pothole", icon: "🛣️", keywords: ["road", "pothole", "damage", "crack", "broken", "sadak", "gaddha"] },
    { value: "other", label: "Other Issue", icon: "📋", keywords: [] },
];

/** Service icons and routes */
export const services = [
    { key: "electricity", icon: "⚡", route: "/bill/electricity", color: "#FBBF24", bgColor: "#FEF3C7" },
    { key: "water", icon: "💧", route: "/bill/water", color: "#3B82F6", bgColor: "#DBEAFE" },
    { key: "gas", icon: "🔥", route: "/bill/gas", color: "#F97316", bgColor: "#FFEDD5" },
    { key: "complaint", icon: "📝", route: "/complaint", color: "#8B5CF6", bgColor: "#EDE9FE" },
];

/** Admin mock data */
export const adminMockData = {
    totalTransactions: 47,
    activeKiosks: "12/15",
    pendingComplaints: 8,
    revenueCollected: "₹1,24,500",

    activityLog: [
        { time: "10:45 PM", kioskId: "K-001", action: "Bill Payment", amount: "₹450", type: "payment" },
        { time: "10:40 PM", kioskId: "K-003", action: "Complaint Filed", amount: "-", type: "complaint" },
        { time: "10:35 PM", kioskId: "K-007", action: "Bill Payment", amount: "₹280", type: "payment" },
        { time: "10:30 PM", kioskId: "K-002", action: "Bill Payment", amount: "₹620", type: "payment" },
        { time: "10:25 PM", kioskId: "K-005", action: "Complaint Filed", amount: "-", type: "complaint" },
        { time: "10:20 PM", kioskId: "K-001", action: "Bill Payment", amount: "₹1,200", type: "payment" },
        { time: "10:15 PM", kioskId: "K-009", action: "Bill Payment", amount: "₹350", type: "payment" },
        { time: "10:10 PM", kioskId: "K-004", action: "Complaint Filed", amount: "-", type: "complaint" },
        { time: "10:05 PM", kioskId: "K-006", action: "Bill Payment", amount: "₹890", type: "payment" },
        { time: "10:00 PM", kioskId: "K-011", action: "Bill Payment", amount: "₹150", type: "payment" },
    ],

    // Hourly transaction data for charts
    hourlyData: [
        { hour: "6 AM", transactions: 2, revenue: 900 },
        { hour: "7 AM", transactions: 5, revenue: 2400 },
        { hour: "8 AM", transactions: 8, revenue: 4200 },
        { hour: "9 AM", transactions: 12, revenue: 6800 },
        { hour: "10 AM", transactions: 15, revenue: 9500 },
        { hour: "11 AM", transactions: 18, revenue: 12400 },
        { hour: "12 PM", transactions: 14, revenue: 8900 },
        { hour: "1 PM", transactions: 10, revenue: 5600 },
        { hour: "2 PM", transactions: 16, revenue: 11200 },
        { hour: "3 PM", transactions: 20, revenue: 14500 },
        { hour: "4 PM", transactions: 22, revenue: 16800 },
        { hour: "5 PM", transactions: 19, revenue: 13400 },
        { hour: "6 PM", transactions: 12, revenue: 7600 },
        { hour: "7 PM", transactions: 8, revenue: 4200 },
        { hour: "8 PM", transactions: 6, revenue: 3100 },
        { hour: "9 PM", transactions: 4, revenue: 1800 },
        { hour: "10 PM", transactions: 3, revenue: 1500 },
    ],

    // Complaint heatmap points (Indian cities)
    heatmapPoints: [
        { name: "Ludhiana", lat: 30.9010, lng: 75.8573, count: 15, x: 230, y: 155 },
        { name: "Chandigarh", lat: 30.7333, lng: 76.7794, count: 8, x: 240, y: 148 },
        { name: "Delhi", lat: 28.7041, lng: 77.1025, count: 23, x: 245, y: 175 },
        { name: "Jaipur", lat: 26.9124, lng: 75.7873, count: 12, x: 225, y: 200 },
        { name: "Mumbai", lat: 19.0760, lng: 72.8777, count: 31, x: 195, y: 290 },
        { name: "Pune", lat: 18.5204, lng: 73.8567, count: 9, x: 205, y: 300 },
        { name: "Bangalore", lat: 12.9716, lng: 77.5946, count: 18, x: 225, y: 370 },
        { name: "Chennai", lat: 13.0827, lng: 80.2707, count: 14, x: 260, y: 365 },
        { name: "Hyderabad", lat: 17.3850, lng: 78.4867, count: 10, x: 240, y: 320 },
        { name: "Kolkata", lat: 22.5726, lng: 88.3639, count: 16, x: 330, y: 255 },
        { name: "Ahmedabad", lat: 23.0225, lng: 72.5714, count: 7, x: 190, y: 245 },
        { name: "Lucknow", lat: 26.8467, lng: 80.9462, count: 11, x: 280, y: 205 },
    ],

    // Service type breakdown for pie chart
    serviceBreakdown: [
        { name: "Electricity", value: 45, color: "#FBBF24" },
        { name: "Water", value: 25, color: "#3B82F6" },
        { name: "Gas", value: 20, color: "#F97316" },
        { name: "Complaints", value: 10, color: "#8B5CF6" },
    ],
};

/** Generate a random transaction ID */
export function generateTxnId() {
    const now = new Date();
    const rand = Math.floor(Math.random() * 90000) + 10000;
    return `TXN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${rand}`;
}

/** Generate a complaint ticket ID */
let complaintCounter = 123;
export function generateComplaintId() {
    complaintCounter++;
    return `COMP-2026-${String(complaintCounter).padStart(5, '0')}`;
}

/** Look up a bill by consumer ID */
export function lookupBill(consumerId) {
    return mockBills.find(b =>
        b.id.toLowerCase() === consumerId.trim().toLowerCase()
    ) || null;
}
