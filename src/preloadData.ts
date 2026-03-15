import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export const preloadDatabase = async (selectedFyId?: string) => {
  console.log('Initializing database...');

  // Helper to check and add
  const addIfNotExists = async (colName: string, data: any, queryFields: string[]) => {
    let q = query(collection(db, colName));
    for (const field of queryFields) {
      q = query(q, where(field, '==', data[field]));
    }
    const snap = await getDocs(q);
    if (snap.empty) {
      return await addDoc(collection(db, colName), data);
    }
    return snap.docs[0];
  };

  // 1. Financial Years
  const fy24 = await addIfNotExists('financialYears', { name: '2024-25' }, ['name']);
  await addIfNotExists('financialYears', { name: '2025-26' }, ['name']);
  await addIfNotExists('financialYears', { name: '2026-27' }, ['name']);

  const targetFyId = selectedFyId || fy24.id;

  // 2. Ranges
  const ranges = ['Rajgarh', 'Habban', 'Sarahan', 'Narag'];
  for (const r of ranges) {
    await addIfNotExists('ranges', { name: r }, ['name']);
  }

  // Helper to add scheme -> sector -> activity -> subActivity
  const addHierarchy = async (schemeName: string, sectorsData: any) => {
    const schemeRef = await addIfNotExists('schemes', { name: schemeName, fyId: targetFyId }, ['name', 'fyId']);
    
    for (const sectorName of Object.keys(sectorsData)) {
      const qSector = query(collection(db, 'sectors'), where('name', '==', sectorName), where('schemeId', '==', schemeRef.id));
      const sectorSnap = await getDocs(qSector);
      let sectorRef = sectorSnap.empty ? await addDoc(collection(db, 'sectors'), { name: sectorName, schemeId: schemeRef.id }) : sectorSnap.docs[0];

      const activitiesData = sectorsData[sectorName];
      
      for (const activityName of Object.keys(activitiesData)) {
        const qActivity = query(collection(db, 'activities'), where('name', '==', activityName), where('sectorId', '==', sectorRef.id));
        const activitySnap = await getDocs(qActivity);
        let activityRef = activitySnap.empty ? await addDoc(collection(db, 'activities'), { name: activityName, sectorId: sectorRef.id }) : activitySnap.docs[0];

        const subActivities = activitiesData[activityName];
        
        for (const subName of subActivities) {
          const qSub = query(collection(db, 'subActivities'), where('name', '==', subName), where('activityId', '==', activityRef.id));
          const subSnap = await getDocs(qSub);
          if (subSnap.empty) {
            await addDoc(collection(db, 'subActivities'), { name: subName, activityId: activityRef.id });
          }
        }
      }
    }
  };

  // 3. CAMPA
  await addHierarchy('CAMPA', {
    'CA': {
      'Plantation': [],
      'Maint of Plantation': [],
      'Nursery': ['1st year', '2nd year', '3rd year', '4th year']
    },
    'NPV': {
      'Plantation': [],
      'Maint of Plantation': [],
      'Lantana New': [],
      'Maint of Lantana': [],
      'Forest Fire': ['Control Burning', 'Fire line Maint', 'Equipments', 'Awareness', 'Fire watchers', 'hiring of vehicle'],
      'SMC Work': ['Roof Rain WHS', 'Check Dam', 'Water Pond', 'R/Wall NT'],
      'Building and Path (FID)': [],
      'Modern Nursery': [],
      'Nursery Work': ['1st year', '2nd year', '3rd year', '4th year']
    }
  });

  // 4. Demand No 16 State Plan
  await addHierarchy('Demand No 16 State Plan', {
    'Default': {
      '2406-01-070-01': ['repair of road, path and building'],
      '2406-01-102-46 MMVVY': ['maint of plantation MMVVY']
    },
    '2406-01-102-43': {
      'Nursery': ['1st year', '2nd year', '3rd year', '4th year'],
      'Plantation': ['plantation']
    }
  });

  // 5. Demand No 32 State Plan
  await addHierarchy('Demand No 32 State Plan', {
    '2406-789-27': {
      'Plantation': ['plantation areas'],
      'Nursery work': ['1st year', '2nd year', '3rd year', '4th year']
    }
  });

  // 6. Empty Schemes
  await addIfNotExists('schemes', { name: 'SNA Sparsh-Fire', fyId: targetFyId }, ['name', 'fyId']);
  await addIfNotExists('schemes', { name: 'Demand No 15 BASP', fyId: targetFyId }, ['name', 'fyId']);

  console.log('Database initialized successfully!');
};
