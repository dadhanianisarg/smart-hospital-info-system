const fs = require('fs');
const path = require('path');
const sampleData = require('../seed/sampleData');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

function getInitialState() {
  return {
    departments: JSON.parse(JSON.stringify(sampleData.departments)),
    doctors: JSON.parse(JSON.stringify(sampleData.doctors)),
    diseases: JSON.parse(JSON.stringify(sampleData.diseases)),
    medicines: JSON.parse(JSON.stringify(sampleData.medicines)),
    patients: JSON.parse(JSON.stringify(sampleData.patients)),
    appointments: JSON.parse(JSON.stringify(sampleData.appointments)),
    prescriptions: JSON.parse(JSON.stringify(sampleData.prescriptions)),
  };
}

class LocalStore {
  constructor() {
    this.dataFile = DATA_FILE;
    this.ensureInitialized();
  }

  ensureInitialized() {
    try {
      if (!fs.existsSync(this.dataFile)) {
        const initial = getInitialState();
        fs.writeFileSync(this.dataFile, JSON.stringify(initial, null, 2), 'utf-8');
      } else {
        // Validate existing JSON
        const raw = fs.readFileSync(this.dataFile, 'utf-8');
        JSON.parse(raw);
      }
    } catch (err) {
      console.warn('[LocalStore] Reinitializing store file due to parse error:', err.message);
      const initial = getInitialState();
      fs.writeFileSync(this.dataFile, JSON.stringify(initial, null, 2), 'utf-8');
    }
  }

  load() {
    try {
      if (!fs.existsSync(this.dataFile)) {
        this.ensureInitialized();
      }
      const raw = fs.readFileSync(this.dataFile, 'utf-8');
      const data = JSON.parse(raw);
      return data;
    } catch (err) {
      console.error('[LocalStore] Error reading store:', err.message);
      return getInitialState();
    }
  }

  save(data) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
      return true;
    } catch (err) {
      console.error('[LocalStore] Error saving store:', err.message);
      return false;
    }
  }

  getCollection(name) {
    const store = this.load();
    return Array.isArray(store[name]) ? store[name] : [];
  }

  find(collectionName, filter = {}) {
    const items = this.getCollection(collectionName);
    if (!filter) return items;
    if (typeof filter === 'function') {
      return items.filter(filter);
    }
    if (Object.keys(filter).length === 0) return items;

    return items.filter(item => {
      for (const [key, val] of Object.entries(filter)) {
        if (typeof val === 'function') {
          if (!val(item[key], item)) return false;
        } else if (val && typeof val === 'object' && val.$regex) {
          const reg = new RegExp(val.$regex, val.$options || 'i');
          if (!reg.test(String(item[key] || ''))) return false;
        } else if (item[key] !== val) {
          return false;
        }
      }
      return true;
    });
  }

  findOne(collectionName, filter = {}) {
    const results = this.find(collectionName, filter);
    return results.length > 0 ? results[0] : null;
  }

  insert(collectionName, item) {
    const store = this.load();
    if (!Array.isArray(store[collectionName])) {
      store[collectionName] = [];
    }

    const crypto = require('crypto');
    const validId = item._id && /^[0-9a-fA-F]{24}$/.test(String(item._id))
      ? String(item._id)
      : crypto.randomBytes(12).toString('hex');

    const doc = {
      ...item,
      _id: validId,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    store[collectionName].push(doc);
    this.save(store);
    return doc;
  }

  update(collectionName, filterFnOrObj, updates) {
    const store = this.load();
    if (!Array.isArray(store[collectionName])) return null;

    let index = -1;
    if (typeof filterFnOrObj === 'function') {
      index = store[collectionName].findIndex(filterFnOrObj);
    } else {
      index = store[collectionName].findIndex(item => {
        return Object.entries(filterFnOrObj).every(([k, v]) => item[k] === v);
      });
    }

    if (index === -1) return null;

    const existing = store[collectionName][index];
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    store[collectionName][index] = updated;
    this.save(store);
    return updated;
  }

  delete(collectionName, filterFnOrObj) {
    const store = this.load();
    if (!Array.isArray(store[collectionName])) return 0;

    const initialLength = store[collectionName].length;
    let filtered;
    if (typeof filterFnOrObj === 'function') {
      filtered = store[collectionName].filter(item => !filterFnOrObj(item));
    } else {
      filtered = store[collectionName].filter(item => {
        return !Object.entries(filterFnOrObj).every(([k, v]) => item[k] === v);
      });
    }

    store[collectionName] = filtered;
    this.save(store);
    return initialLength - filtered.length;
  }
}

const localStore = new LocalStore();
module.exports = localStore;
