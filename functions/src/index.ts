import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

admin.initializeApp(functions.config().firebase);

const db = admin.firestore();

export const verifyAdmin = functions.https.onCall(async (data, context) => {
    const { email, idToken } = data;
    if (idToken) {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const hasAuthority = await checkEmailAuthority(decodedToken.email);
        if (hasAuthority) {
            return { hasAuthority, ...decodedToken };
        }
    } else if (email) {
        return { hasAuthority: await checkEmailAuthority(email) }
    }
    return { hasAuthority: false };
});

const checkEmailAuthority = async (email:any) => {
    const snapshot = await db.collection("setting").doc("admin").get();
    const adminData = snapshot.data();
    return adminData && adminData.email.includes(email);
}

export const checkUpdate = functions.https.onRequest(async (req, res) => {
    const lastTimestamp = req.query.timestamp;
    const tags = await getUpdate("tags", lastTimestamp);
    const duas = await getUpdate("duas", lastTimestamp);
    const themes = await getUpdate("themes", lastTimestamp);
    res.send({ duas, tags, themes });
});

const getUpdate = async (name:string, lastTimestamp:any) => {
    const snapshot = await db.collection(name).get();
    return snapshot.docs
    .filter(doc => doc.data().timestamp > lastTimestamp)
    .map(doc => {
        return ({ id: doc.id, ...doc.data() });
    });
}

export const getTags = functions.https.onCall((data, context) => open('tags'));

export const getDuas = functions.https.onCall((data, context) => open('duas'));

export const getThemes = functions.https.onCall((data, context) => open('themes'));

const open = async (name:string) => {
    const snapshot = await db.collection(name).get();
    return snapshot.docs.map(doc => {
        const { timestamp, ...data } = doc.data();
        return ({ id: doc.id, ...data });
    });
}

export const setTag = functions.https.onCall((data, context) => save('tags', data));

export const setDua = functions.https.onCall((data, context) => save('duas', data));

export const setTheme = functions.https.onCall((data, context) => save('themes', data));

const save = async (name:string, data:any) => {
    const ref = db.collection(name);

    const timestamp = Date.now();
    const { id: numId, ...newData } = data;

    if (numId) {
        const id = String(numId);
        const doc = await ref.doc(id).get();
        const prevData = doc.data();
        if (isSame(newData, prevData)) {
            return { id, ...prevData }
        } else {
            await ref.doc(id).set({ ...newData, timestamp });
            return { id, ...newData }
        }
    } else {
        const id = String(timestamp);
        await ref.doc(id).set({ ...newData, timestamp });
        return { id, ...newData };
    }
}

export const setAllTag = functions.https.onCall((data, context) => saveAll('tags', data));

export const setAllDua = functions.https.onCall((data, context) => saveAll('duas', data));

export const setAllTheme = functions.https.onCall((data, context) => saveAll('themes', data));

const saveAll = async (name:string, list:any) => {
    const ref = db.collection(name);

    const timestamp = Date.now();
    return list.map(async (data:any) => {
        const { id: numId, ...newData } = data;

        if (numId) {
            const id = String(numId);
            const doc = await ref.doc(id).get();
            const prevData = doc.data();
            if (isSame(newData, prevData)) {
                return { id, ...prevData }
            } else {
                await ref.doc(id).set({ ...newData, timestamp });
                return { id, ...newData }
            }
        }
    })
}

const isSame = (data1:any, data2:any) => {
    if (data1 === data2) return true;

    if (!data1 || !data2) return false;

    if (typeof data1 !== typeof data2) return false;

    if (Array.isArray(data1)) {
        return data1.reduce((acc, item, key) => isSame(item, data2[key]), true);
    }
    
    if (typeof data1 === 'object') {
        Object.keys(data1).reduce((acc, key) => isSame(data1[key], data2[key]), true);
    }
    
    return false;
}