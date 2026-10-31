const { execSync } = require('child_process');
const path = require('path');

function checkGitUpdate(log = console.log) {
    try {
        const rootDir = path.resolve(__dirname, '..');
        // Fetch remote quietly
        execSync('git fetch origin main', { cwd: rootDir, stdio: 'ignore', timeout: 8000 });
        const local = execSync('git rev-parse HEAD', { cwd: rootDir, timeout: 3000 }).toString().trim();
        const remote = execSync('git rev-parse origin/main', { cwd: rootDir, timeout: 3000 }).toString().trim();

        if (local && remote && local !== remote) {
            log(`[AutoUpdate] Update found (${local.slice(0, 7)} -> ${remote.slice(0, 7)}). Pulling...`);
            execSync('git pull origin main', { cwd: rootDir, stdio: 'ignore', timeout: 15000 });
            execSync('npm install --omit=dev --silent', { cwd: rootDir, stdio: 'ignore', timeout: 30000 });
            log('[AutoUpdate] Update complete! Triggering seamless restart...');
            return true;
        }
    } catch (e) {
        // Offline or git not available
    }
    return false;
}

module.exports = { checkGitUpdate };
