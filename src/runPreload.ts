import { preloadDatabase } from './preloadData';

preloadDatabase().then(() => {
  console.log('Done');
  process.exit(0);
}).catch(e => {
  console.error(e);
  process.exit(1);
});
