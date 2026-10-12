/** The noun for a count: plural(1, 'project') is "project", plural(2, 'project') is "projects". */
export const plural = (count: number, one: string, many = `${one}s`) => (count === 1 ? one : many)
