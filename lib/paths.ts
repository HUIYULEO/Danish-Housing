/**
 * 运行时资源路径。
 *
 * next.config 的 basePath 只管 Next 自己生成的那些 URL（页面、_next/ 下的产物）。
 * 我们在代码里手写的 fetch("/geo/...")、DuckDB 注册的 Parquet URL、
 * 还有 worker 的路径，Next 一个都不会帮忙加前缀 —— 部署到
 * GitHub Pages 的项目站点（挂在 /<repo>/ 下面）时全都会 404。
 *
 * 所以这些路径一律走这里，不要在组件里手写以 "/" 开头的资源路径。
 */

// NEXT_PUBLIC_ 前缀的环境变量会在构建时内联进客户端产物
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

/** 把站内资源路径补上 basePath。传入的路径必须以 "/" 开头。 */
export function asset(path: string): string {
  return `${BASE}${path}`;
}

/** 绝对 URL，DuckDB 注册 HTTP 文件时需要完整的 origin。 */
export function assetUrl(path: string): string {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return `${origin}${asset(path)}`;
}
