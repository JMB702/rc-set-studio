// The prompt behind the "Copy agent prompt" button. Keep it in step with README.md, AGENTS.md and
// package.json scripts; tests/agent-prompt.test.mjs fails if a command or file it names goes missing.
export const REPO = 'JMB702/rc-set-studio';
export const SKILL_PATH = '.claude/skills/rc-set-sync/SKILL.md';

export const agentPrompt = `You are helping me change RC Set Studio, an open-source web app: a 3D viewer, step-by-step build guide and pricing guide for a modular scenic set (8×4 and 10×4 wall panels, jacks, floors).

REPO (public): https://github.com/${REPO}
Needs Node 20+, npm and git. The GitHub CLI (gh) turns steps 1 and 5 into one command each.

1. GET THE CODE
   gh repo fork ${REPO} --clone --default-branch-only && cd rc-set-studio
   No gh? Run: git clone https://github.com/${REPO}.git && cd rc-set-studio
   then fork it on GitHub and add your fork as a remote before you push.

2. READ THE RULES BEFORE EDITING ANYTHING
   Read AGENTS.md, then follow ${SKILL_PATH}.
   Core rule: every change to the set must also update the Build guide and the Pricing guide in the same pull request. If the change needs more or less material, carry it through every place that material appears (materials JSON, shopping lists, cut list, step text, design notes, tests).

3. RUN IT
   npm install
   npm start
   Open the URL it prints (normally http://localhost:8787). It rebuilds when you edit files in public/ or worker/, so just refresh the page. No accounts or API keys are needed.

4. CHECK YOUR WORK
   npm run check    (all tests must pass)
   npm run quote    (prints the pricing totals; put the before and after in the pull request)
   Look at the changed area in Explore set, Build guide and Pricing guide, at phone width (390px) and desktop.

5. SUBMIT
   git switch -c <short-branch-name>
   git add -A && git commit -m "<what changed and why>"
   git push -u origin HEAD
   gh pr create --repo ${REPO} --fill
   Complete the checklist in the pull request. Never push to main. Do not commit node_modules, dist or .wrangler.

THE CHANGE I WANT:
`;

async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  try {
    const area = document.createElement('textarea');
    area.value = text; area.setAttribute('readonly', ''); area.style.cssText = 'position:fixed;opacity:0';
    document.body.append(area); area.select();
    const ok = document.execCommand('copy'); area.remove(); return ok;
  } catch { return false; }
}

if (typeof document !== 'undefined') {
  const button = document.querySelector('#agent-prompt-copy'), label = document.querySelector('#agent-prompt-label'), dialog = document.querySelector('#agent-prompt-dialog');
  if (button && label) {
    let reset;
    const idle = label.innerHTML;
    button.addEventListener('click', async () => {
      clearTimeout(reset);
      if (await copyText(agentPrompt)) {
        button.classList.add('copied'); label.textContent = 'Copied ✓';
      } else if (dialog?.showModal) {
        dialog.querySelector('textarea').value = agentPrompt; dialog.showModal(); dialog.querySelector('textarea').select();
      } else label.textContent = 'Copy failed';
      reset = setTimeout(() => { button.classList.remove('copied'); label.innerHTML = idle; }, 3000);
    });
  }
}
