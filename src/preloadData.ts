import { collection, addDoc, getDocs } from 'firebase/firestore';
import { db } from './firebase';

export const preloadDatabase = async () => {
  const fysSnap = await getDocs(collection(db, 'financialYears'));
  if (!fysSnap.empty) {
    console.log('Database already initialized.');
    return;
  }

  console.log('Initializing database...');

  // 1. Financial Years
  const fy24 = await addDoc(collection(db, 'financialYears'), { name: '2024-25' });
  await addDoc(collection(db, 'financialYears'), { name: '2025-26' });
  await addDoc(collection(db, 'financialYears'), { name: '2026-27' });

  // 2. Ranges
  const ranges = ['Rajgarh', 'Habban', 'Sarahan', 'Narag'];
  for (const r of ranges) {
    await addDoc(collection(db, 'ranges'), { name: r });
  }

  // Helper to add scheme -> sector -> activity -> subActivity
  const addHierarchy = async (schemeName: string, sectorsData: any) => {
    const schemeRef = await addDoc(collection(db, 'schemes'), { name: schemeName, fyId: fy24.id });
    
    for (const sectorName of Object.keys(sectorsData)) {
      const sectorRef = await addDoc(collection(db, 'sectors'), { name: sectorName, schemeId: schemeRef.id });
      const activitiesData = sectorsData[sectorName];
      
      for (const activityName of Object.keys(activitiesData)) {
        const activityRef = await addDoc(collection(db, 'activities'), { name: activityName, sectorId: sectorRef.id });
        const subActivities = activitiesData[activityName];
        
        for (const subName of subActivities) {
          await addDoc(collection(db, 'subActivities'), { name: subName, activityId: activityRef.id });
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
  await addDoc(collection(db, 'schemes'), { name: 'SNA Sparsh-Fire', fyId: fy24.id });
  await addDoc(collection(db, 'schemes'), { name: 'Demand No 15 BASP', fyId: fy24.id });

  console.log('Database initialized successfully!');
};
