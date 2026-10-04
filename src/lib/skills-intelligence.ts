const aliases: Record<string, string> = {
  js: "JavaScript",
  javascript: "JavaScript",
  ts: "TypeScript",
  typescript: "TypeScript",
  postgres: "PostgreSQL",
  postgresql: "PostgreSQL",
  aws: "Amazon Web Services",
  "amazon web services": "Amazon Web Services",
  "react.js": "React",
  react: "React",
  python: "Python",
  java: "Java",
  "node.js": "Node.js",
  nodejs: "Node.js",
  docker: "Docker",
  kubernetes: "Kubernetes",
  sql: "SQL",
  mongodb: "MongoDB",
  azure: "Azure",
  git: "Git",
  "c++": "C++",
  redis: "Redis",
  django: "Django",
  angular: "Angular",
  vue: "Vue",
  "vue.js": "Vue",
  "google cloud": "Google Cloud",
};
export function canonicalSkill(s: string) {
  return aliases[s.trim().toLowerCase()] || s.trim().slice(0, 80);
}
export function skillCategory(s: string) {
  const n = canonicalSkill(s);
  return ["JavaScript", "TypeScript", "Python", "Java", "C++", "SQL"].includes(
    n,
  )
    ? "Language"
    : ["React", "Node.js", "Django", "Angular", "Vue"].includes(n)
      ? "Framework"
      : ["Amazon Web Services", "Azure", "Google Cloud"].includes(n)
        ? "Cloud"
        : ["PostgreSQL", "MongoDB", "Redis"].includes(n)
          ? "Database"
          : "Tool";
}
export function requirements(text: string) {
  return {
    years: Number(
      text.match(/(\d+)(?:\s*(?:-|–|to)\s*\d+)?\+?\s*(?:years|yrs)/i)?.[1] || 0,
    ),
    education: /ph\.?d|doctorate/i.test(text)
      ? "Doctorate"
      : /master/i.test(text)
        ? "Master"
        : /bachelor|b\.?s\.? degree/i.test(text)
          ? "Bachelor"
          : "",
  };
}
export function matchScore(
  skills: { skill: { name: string }; preferred: boolean }[],
  profile: { name: string; proficiency: string }[],
  text: string,
  years: number,
  education: string,
) {
  const required = skills
      .filter((s) => !s.preferred)
      .map((s) => canonicalSkill(s.skill.name)),
    preferred = skills
      .filter((s) => s.preferred)
      .map((s) => canonicalSkill(s.skill.name));
  const weight: Record<string, number> = {
    Learning: 0.25,
    Familiar: 0.5,
    Proficient: 0.8,
    Strong: 1,
  };
  const lookup = new Map(
    profile.map((s) => [canonicalSkill(s.name), weight[s.proficiency] || 0]),
  );
  const req = requirements(text),
    levels = ["", "Bachelor", "Master", "Doctorate"];
  const skill = required.length
    ? Math.round(
        (required.reduce((v, s) => v + (lookup.get(s) || 0), 0) /
          required.length) *
          100,
      )
    : null;
  const experience = req.years
    ? Math.round(Math.min(1, years / req.years) * 100)
    : null;
  const edu = req.education
    ? levels.indexOf(education) >= levels.indexOf(req.education)
      ? 100
      : 0
    : null;
  const parts = [
    { name: "Skills", score: skill, weight: 0.7 },
    { name: "Experience", score: experience, weight: 0.2 },
    { name: "Education", score: edu, weight: 0.1 },
  ];
  const available = parts.filter((p) => p.score !== null),
    totalWeight = available.reduce((n, p) => n + p.weight, 0);
  return {
    score: totalWeight
      ? Math.round(
          available.reduce((n, p) => n + p.score! * p.weight, 0) / totalWeight,
        )
      : null,
    parts,
    matched: required.filter((s) => lookup.has(s)),
    missing: required.filter((s) => !lookup.has(s)),
    preferred,
    requirements: req,
  };
}
