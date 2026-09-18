// A repository Pages path is inferred in Actions. configure-pages supplies the
// real base_path (including an empty path for a custom domain or user site).
export function resolveBase(env = process.env) {
  let base = env.PAGES_BASE_PATH;
  if (base === undefined) {
    const [owner, repo] = (env.GITHUB_REPOSITORY ?? '').split('/');
    base = repo && repo.toLowerCase() !== `${owner}.github.io`.toLowerCase() ? `/${repo}/` : '/';
  }
  base = `/${base.split('/').filter(Boolean).join('/')}/`.replace(/^\/\/$/, '/');
  if (!/^\/(?:[\w.-]+\/)*$/.test(base)) throw new Error('PAGES_BASE_PATH must be an absolute pathname, e.g. /logic-core/.');
  return base;
}
