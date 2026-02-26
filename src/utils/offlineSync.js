/**
 * ═══════════════════════════════════════════════════════════
 * SUVIDHA Setu - Offline Sync Manager
 * Uses localforage (IndexedDB fallback) for offline storage
 * ═══════════════════════════════════════════════════════════
 */

import localforage from 'localforage';

// Configure localforage instances
const txnStore = localforage.createInstance({
    name: 'suvidha-neo',
    storeName: 'offlineTransactions',
    description: 'Pending payment transactions',
});

const complaintStore = localforage.createInstance({
    name: 'suvidha-neo',
    storeName: 'offlineComplaints',
    description: 'Pending complaints',
});

/**
 * Save a payment transaction for offline sync
 * @param {object} transaction - Transaction data
 */
export async function saveOfflineTransaction(transaction) {
    try {
        const existing = (await txnStore.getItem('transactions')) || [];
        existing.push({
            ...transaction,
            syncStatus: 'pending',
            savedAt: new Date().toISOString(),
        });
        await txnStore.setItem('transactions', existing);
        return true;
    } catch (err) {
        console.error('Error saving offline transaction:', err);
        return false;
    }
}

/**
 * Save a complaint for offline sync
 * @param {object} complaint - Complaint data
 */
export async function saveOfflineComplaint(complaint) {
    try {
        const existing = (await complaintStore.getItem('complaints')) || [];
        existing.push({
            ...complaint,
            syncStatus: 'pending',
            savedAt: new Date().toISOString(),
        });
        await complaintStore.setItem('complaints', existing);
        return true;
    } catch (err) {
        console.error('Error saving offline complaint:', err);
        return false;
    }
}

/**
 * Get all pending (unsynced) transactions
 * @returns {Promise<Array>}
 */
export async function getPendingTransactions() {
    const all = (await txnStore.getItem('transactions')) || [];
    return all.filter(t => t.syncStatus === 'pending');
}

/**
 * Get all pending (unsynced) complaints
 * @returns {Promise<Array>}
 */
export async function getPendingComplaints() {
    const all = (await complaintStore.getItem('complaints')) || [];
    return all.filter(c => c.syncStatus === 'pending');
}

/**
 * Get the total count of all pending items
 * @returns {Promise<number>}
 */
export async function getPendingCount() {
    const txns = await getPendingTransactions();
    const comps = await getPendingComplaints();
    return txns.length + comps.length;
}

/**
 * Simulate syncing all pending data to server
 * Returns array of synced items
 * @param {function} onProgress - Callback with progress updates
 * @returns {Promise<{transactions: number, complaints: number}>}
 */
export async function syncPendingData(onProgress) {
    const pendingTxns = await getPendingTransactions();
    const pendingComps = await getPendingComplaints();

    const total = pendingTxns.length + pendingComps.length;
    let synced = 0;

    // Simulate syncing transactions
    if (pendingTxns.length > 0) {
        const allTxns = (await txnStore.getItem('transactions')) || [];
        for (const txn of allTxns) {
            if (txn.syncStatus === 'pending') {
                // Simulate network delay
                await new Promise(r => setTimeout(r, 800));
                txn.syncStatus = 'synced';
                txn.syncedAt = new Date().toISOString();
                synced++;
                onProgress?.({ synced, total, current: txn });
            }
        }
        await txnStore.setItem('transactions', allTxns);
    }

    // Simulate syncing complaints
    if (pendingComps.length > 0) {
        const allComps = (await complaintStore.getItem('complaints')) || [];
        for (const comp of allComps) {
            if (comp.syncStatus === 'pending') {
                await new Promise(r => setTimeout(r, 800));
                comp.syncStatus = 'synced';
                comp.syncedAt = new Date().toISOString();
                synced++;
                onProgress?.({ synced, total, current: comp });
            }
        }
        await complaintStore.setItem('complaints', allComps);
    }

    return { transactions: pendingTxns.length, complaints: pendingComps.length };
}

/**
 * Clear all synced data (housekeeping)
 */
export async function clearSyncedData() {
    const allTxns = (await txnStore.getItem('transactions')) || [];
    const pendingTxns = allTxns.filter(t => t.syncStatus === 'pending');
    await txnStore.setItem('transactions', pendingTxns);

    const allComps = (await complaintStore.getItem('complaints')) || [];
    const pendingComps = allComps.filter(c => c.syncStatus === 'pending');
    await complaintStore.setItem('complaints', pendingComps);
}
