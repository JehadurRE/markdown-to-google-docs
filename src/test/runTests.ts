import { runAllTests } from './suite';

runAllTests().then((success) => {
  if (!success) {
    process.exit(1);
  }
}).catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
