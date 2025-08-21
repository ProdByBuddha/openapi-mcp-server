#!/usr/bin/env node
/*
 * Build/publish the GitHub wiki from local docs.
 * - Creates/updates pages: Home.md (from README.md), Tools.md (from examples/generated/TOOLS.md),
 *   Changelog.md (from CHANGELOG.md), Security.md, Contributing.md, Code-of-Conduct.md.
 * - Clones the repo's wiki using the repository URL in package.json.
 * - Commits and pushes changes.
 *
 * Usage: node scripts/build-wiki.js
 * Env (optional): GIT_AUTHOR_NAME, GIT_AUTHOR_EMAIL, GIT_COMMITTER_NAME, GIT_COMMITTER_EMAIL
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

function run(cmd, args, opts = {}) {
  const res = spawnSync(cmd, args, { stdio: 'inherit', ...opts });
  if (res.status !== 0) throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
}

function readJSON(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function deriveWikiUrl(pkg) {
  const url = pkg?.repository?.url || '';
  // Support forms like git+https://github.com/owner/repo.git or https://github.com/owner/repo
  const m = url.match(/github\.com\/?([^/]+)\/([^/.]+)(?:\.git)?/i);
  if (!m) throw new Error('Could not derive GitHub repo from package.json repository.url');
  const owner = m[1];
  const repo = m[2];
  return `https://github.com/${owner}/${repo}.wiki.git`;
}

function copyIfExists(src, dest) {
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, dest);
  return true;
}

function main() {
  const root = path.resolve(__dirname, '..');
  const pkg = readJSON(path.join(root, 'package.json'));
  const wikiUrl = deriveWikiUrl(pkg);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wiki-'));
  process.chdir(tmp);
  run('git', ['clone', wikiUrl, '.']);

  // Ensure authors
  const name = process.env.GIT_AUTHOR_NAME || 'automation-bot';
  const email = process.env.GIT_AUTHOR_EMAIL || 'bot@example.com';
  run('git', ['config', 'user.name', name]);
  run('git', ['config', 'user.email', email]);

  // Pages
  const pages = [];
  // Home.md from README.md
  const readmePath = path.join(root, 'README.md');
  if (fs.existsSync(readmePath)) {
    // Keep README content as Home.md for the wiki
    const homeDest = path.join(tmp, 'Home.md');
    fs.writeFileSync(homeDest, fs.readFileSync(readmePath));
    pages.push('Home.md');
  }
  // Tools.md from examples/generated/TOOLS.md
  const toolsSrc = path.join(root, 'examples', 'generated', 'TOOLS.md');
  if (copyIfExists(toolsSrc, path.join(tmp, 'Tools.md'))) pages.push('Tools.md');

  // Changelog
  const changelogSrc = path.join(root, 'CHANGELOG.md');
  if (copyIfExists(changelogSrc, path.join(tmp, 'Changelog.md'))) pages.push('Changelog.md');

  // Security
  const secSrc = path.join(root, 'SECURITY.md');
  if (copyIfExists(secSrc, path.join(tmp, 'Security.md'))) pages.push('Security.md');

  // Contributing
  const cSrc = path.join(root, 'CONTRIBUTING.md');
  if (copyIfExists(cSrc, path.join(tmp, 'Contributing.md'))) pages.push('Contributing.md');

  // Code of Conduct
  const cocSrc = path.join(root, 'CODE_OF_CONDUCT.md');
  if (copyIfExists(cocSrc, path.join(tmp, 'Code-of-Conduct.md'))) pages.push('Code-of-Conduct.md');

  // Vibe.md (non-technical intro)
  const vibeSrc = path.join(root, 'VIBE.md');
  if (copyIfExists(vibeSrc, path.join(tmp, 'Vibe.md'))) pages.push('Vibe.md');

  if (pages.length === 0) {
    console.log('No pages to update.');
    process.exit(0);
  }

  // Sidebar and Footer
  try {
    const sidebarItems = [
      ['Home', 'Home'],
      ['Tools', 'Tools'],
      ['Changelog', 'Changelog'],
      ['Security', 'Security'],
      ['Contributing', 'Contributing'],
      ['Code of Conduct', 'Code-of-Conduct'],
      ['Vibe', 'Vibe']
    ];
    const helpfulLinks = [
      ['🚀 WisprFlow AI (affiliate)', 'https://wisprflow.ai/r/BILLY53']
    ];
    let sidebar = '## ✨ Helpful Links\n\n';
    for (const [title, url] of helpfulLinks) {
      sidebar += `- ${title} → [Open](${url})\n`;
    }
    sidebar += '\n## 📚 Pages\n\n';
    const pageIcons = {
      'Home': '🏠',
      'Tools': '🧰',
      'Changelog': '📝',
      'Security': '🔐',
      'Contributing': '🤝',
      'Code of Conduct': '📜',
      'Vibe': '🎵'
    };
    for (const [title, page] of sidebarItems) {
      const p = path.join(tmp, page + '.md');
      if (fs.existsSync(p)) sidebar += `- ${pageIcons[title] || ''} [${title}](${page})\n`;
    }
    sidebar += '\n## ⚡ Quick Commands\n\n';
    sidebar += '- OpenAPI Server: `npm run mcp:openapi`\n';
    sidebar += '- n8n Server: `npm run mcp:n8n`\n';
    fs.writeFileSync(path.join(tmp, '_Sidebar.md'), sidebar);
    pages.push('_Sidebar.md');

    const donationUrl = 'https://donate.stripe.com/9AQbLka97fFx75K8ww';
    // Build crypto links from donate.json if present
    let cryptoMd = '';
    try {
      const donateJsonPath = path.join(root, 'donate.json');
      if (fs.existsSync(donateJsonPath)) {
        const wallets = JSON.parse(fs.readFileSync(donateJsonPath, 'utf8'));
        const entries = Object.entries(wallets || {});
        if (entries.length) {
          cryptoMd += '\n<details>\n<summary><strong>Crypto wallets</strong></summary>\n\n';
          for (const [chain, addr] of entries) {
            const label = chain.toUpperCase();
            cryptoMd += `- ${label}: \`${addr}\`\n`;
          }
          cryptoMd += '\n</details>\n';
        }
      }
    } catch (_) {}

    const footer = [
      '<div align="center">',
      '',
      '— Made with ❤️ —',
      '',
      `[![Buy Me A Coffee](https://img.shields.io/badge/Support-Buy%20me%20a%20coffee-ffdd00?logo=buymeacoffee&logoColor=black)](${donationUrl})`,
      '',
      '</div>',
      '',
      cryptoMd,
      ''
    ].join('\n');
    fs.writeFileSync(path.join(tmp, '_Footer.md'), footer);
    pages.push('_Footer.md');
  } catch (_) {}

  run('git', ['add', '-A']);
  // Check if there are changes
  const status = spawnSync('git', ['diff', '--cached', '--quiet'], { stdio: 'inherit' });
  if (status.status === 0) {
    console.log('No changes to commit.');
    return;
  }
  run('git', ['commit', '-m', 'docs(wiki): rebuild wiki from README/TOOLS/CHANGELOG']);
  run('git', ['push', 'origin', 'HEAD']);
  console.log('Wiki updated:', pages.join(', '));
}

main();
