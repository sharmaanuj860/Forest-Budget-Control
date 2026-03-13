const fs = require('fs');

let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = [
  {
    find: `  const handleAddRange = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    if (editingItem?.type === 'Range') {
      await updateDoc(doc(db, 'ranges', editingItem.item.id), { name });
      setEditingItem(null);
    } else {
      await addDoc(collection(db, 'ranges'), { name });
    }
    e.target.reset();
  };`,
    replace: `  const handleAddRange = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    try {
      if (editingItem?.type === 'Range') {
        await updateDoc(doc(db, 'ranges', editingItem.item.id), { name });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'ranges'), { name });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Range' ? OperationType.UPDATE : OperationType.CREATE, 'ranges');
    }
  };`
  },
  {
    find: `  const handleAddScheme = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const fyId = e.target.fyId.value;
    if (editingItem?.type === 'Scheme') {
      await updateDoc(doc(db, 'schemes', editingItem.item.id), { name, fyId });
      setEditingItem(null);
    } else {
      await addDoc(collection(db, 'schemes'), { name, fyId });
    }
    e.target.reset();
  };`,
    replace: `  const handleAddScheme = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const fyId = e.target.fyId.value;
    try {
      if (editingItem?.type === 'Scheme') {
        await updateDoc(doc(db, 'schemes', editingItem.item.id), { name, fyId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'schemes'), { name, fyId });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Scheme' ? OperationType.UPDATE : OperationType.CREATE, 'schemes');
    }
  };`
  },
  {
    find: `  const handleAddSector = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const schemeId = e.target.schemeId.value;
    if (editingItem?.type === 'Sector') {
      await updateDoc(doc(db, 'sectors', editingItem.item.id), { name, schemeId });
      setEditingItem(null);
    } else {
      await addDoc(collection(db, 'sectors'), { name, schemeId });
    }
    e.target.reset();
  };`,
    replace: `  const handleAddSector = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const schemeId = e.target.schemeId.value;
    try {
      if (editingItem?.type === 'Sector') {
        await updateDoc(doc(db, 'sectors', editingItem.item.id), { name, schemeId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'sectors'), { name, schemeId });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Sector' ? OperationType.UPDATE : OperationType.CREATE, 'sectors');
    }
  };`
  },
  {
    find: `  const handleAddActivity = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const sectorId = e.target.sectorId?.value || null;
    const schemeId = e.target.schemeId?.value || null;

    if (!sectorId && !schemeId) {
      alert("Please select either a Sector or a Scheme");
      return;
    }

    if (editingItem?.type === 'Activity') {
      await updateDoc(doc(db, 'activities', editingItem.item.id), { name, sectorId, schemeId });
      setEditingItem(null);
    } else {
      await addDoc(collection(db, 'activities'), { id: Date.now().toString(), sectorId, schemeId, name });
    }
    e.target.reset();
  };`,
    replace: `  const handleAddActivity = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const sectorId = e.target.sectorId?.value || null;
    const schemeId = e.target.schemeId?.value || null;

    if (!sectorId && !schemeId) {
      alert("Please select either a Sector or a Scheme");
      return;
    }

    try {
      if (editingItem?.type === 'Activity') {
        await updateDoc(doc(db, 'activities', editingItem.item.id), { name, sectorId, schemeId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'activities'), { id: Date.now().toString(), sectorId, schemeId, name });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Activity' ? OperationType.UPDATE : OperationType.CREATE, 'activities');
    }
  };`
  },
  {
    find: `  const handleAddSubActivity = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const activityId = e.target.activityId.value;
    if (editingItem?.type === 'Sub-Activity') {
      await updateDoc(doc(db, 'subActivities', editingItem.item.id), { name, activityId });
      setEditingItem(null);
    } else {
      await addDoc(collection(db, 'subActivities'), { activityId, name });
    }
    e.target.reset();
  };`,
    replace: `  const handleAddSubActivity = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const activityId = e.target.activityId.value;
    try {
      if (editingItem?.type === 'Sub-Activity') {
        await updateDoc(doc(db, 'subActivities', editingItem.item.id), { name, activityId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'subActivities'), { activityId, name });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Sub-Activity' ? OperationType.UPDATE : OperationType.CREATE, 'subActivities');
    }
  };`
  },
  {
    find: `  const handleAddSoe = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const budgetLimit = parseFloat(e.target.budgetLimit.value);
    const subActivityId = e.target.subActivityId.value || null;
    const activityId = subActivityId ? null : (e.target.activityId.value || null);

    if (editingItem?.type === 'SOE') {
      await updateDoc(doc(db, 'soeHeads', editingItem.item.id), { activityId, subActivityId, name, budgetLimit });
      setEditingItem(null);
    } else {
      await addDoc(collection(db, 'soeHeads'), { activityId, subActivityId, name, budgetLimit });
    }
    e.target.reset();
  };`,
    replace: `  const handleAddSoe = async (e: any) => {
    e.preventDefault();
    const name = e.target.name.value;
    const budgetLimit = parseFloat(e.target.budgetLimit.value);
    const subActivityId = e.target.subActivityId.value || null;
    const activityId = subActivityId ? null : (e.target.activityId.value || null);

    try {
      if (editingItem?.type === 'SOE') {
        await updateDoc(doc(db, 'soeHeads', editingItem.item.id), { activityId, subActivityId, name, budgetLimit });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'soeHeads'), { activityId, subActivityId, name, budgetLimit });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'SOE' ? OperationType.UPDATE : OperationType.CREATE, 'soeHeads');
    }
  };`
  },
  {
    find: `  const handleAddAllocation = async (e: any) => {
    e.preventDefault();
    const soeId = e.target.soeId.value;
    const rangeId = e.target.rangeId.value;
    const amount = parseFloat(e.target.amount.value);
    
    if (editingItem?.type === 'Allocation') {
      await updateDoc(doc(db, 'allocations', editingItem.item.id), { soeId, rangeId, amount });
      setEditingItem(null);
    } else {
      await addDoc(collection(db, 'allocations'), { soeId, rangeId, amount });
    }
    e.target.reset();
  };`,
    replace: `  const handleAddAllocation = async (e: any) => {
    e.preventDefault();
    const soeId = e.target.soeId.value;
    const rangeId = e.target.rangeId.value;
    const amount = parseFloat(e.target.amount.value);
    
    try {
      if (editingItem?.type === 'Allocation') {
        await updateDoc(doc(db, 'allocations', editingItem.item.id), { soeId, rangeId, amount });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'allocations'), { soeId, rangeId, amount });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Allocation' ? OperationType.UPDATE : OperationType.CREATE, 'allocations');
    }
  };`
  },
  {
    find: `  const handleAddExpense = async (e: any) => {
    e.preventDefault();
    const allocationId = e.target.allocationId.value;
    const amount = parseFloat(e.target.amount.value);
    const date = e.target.date.value;
    const description = e.target.description.value;
    
    const alloc = allocations.find(a => a.id === allocationId);
    const soe = soes.find(s => s.id === alloc?.soeId);
    const activityId = soe?.activityId || subActivities.find(sa => sa.id === soe?.subActivityId)?.activityId;

    if (editingItem?.type === 'Expense') {
      await updateDoc(doc(db, 'expenditures', editingItem.item.id), { allocationId, amount, date, description, activityId });
      setEditingItem(null);
    } else {
      await addDoc(collection(db, 'expenditures'), { allocationId, amount, date, description, activityId });
    }
    e.target.reset();
  };`,
    replace: `  const handleAddExpense = async (e: any) => {
    e.preventDefault();
    const allocationId = e.target.allocationId.value;
    const amount = parseFloat(e.target.amount.value);
    const date = e.target.date.value;
    const description = e.target.description.value;
    
    const alloc = allocations.find(a => a.id === allocationId);
    const soe = soes.find(s => s.id === alloc?.soeId);
    const activityId = soe?.activityId || subActivities.find(sa => sa.id === soe?.subActivityId)?.activityId;

    try {
      if (editingItem?.type === 'Expense') {
        await updateDoc(doc(db, 'expenditures', editingItem.item.id), { allocationId, amount, date, description, activityId });
        setEditingItem(null);
      } else {
        await addDoc(collection(db, 'expenditures'), { allocationId, amount, date, description, activityId });
      }
      e.target.reset();
    } catch (error) {
      handleFirestoreError(error, editingItem?.type === 'Expense' ? OperationType.UPDATE : OperationType.CREATE, 'expenditures');
    }
  };`
  },
  {
    find: `  const handleDelete = async (collectionName: string, id: string) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      await deleteDoc(doc(db, collectionName, id));
    }
  };`,
    replace: `  const handleDelete = async (collectionName: string, id: string) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      try {
        await deleteDoc(doc(db, collectionName, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, collectionName);
      }
    }
  };`
  },
  {
    find: `  const handleUserRoleChange = async (userId: string, newRole: 'admin' | 'deo') => {
    await updateDoc(doc(db, 'users', userId), { role: newRole });
  };`,
    replace: `  const handleUserRoleChange = async (userId: string, newRole: 'admin' | 'deo') => {
    try {
      await updateDoc(doc(db, 'users', userId), { role: newRole });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'users');
    }
  };`
  },
  {
    find: `  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Delete this user access?')) {
      await deleteDoc(doc(db, 'users', userId));
    }
  };`,
    replace: `  const handleDeleteUser = async (userId: string) => {
    if (window.confirm('Delete this user access?')) {
      try {
        await deleteDoc(doc(db, 'users', userId));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, 'users');
      }
    }
  };`
  }
];

let changed = false;
for (const r of replacements) {
  if (content.includes(r.find)) {
    content = content.replace(r.find, r.replace);
    changed = true;
  } else {
    console.error('Could not find:', r.find.substring(0, 50));
  }
}

if (changed) {
  fs.writeFileSync('src/App.tsx', content);
  console.log('Successfully patched handlers');
} else {
  console.log('No changes made');
}
