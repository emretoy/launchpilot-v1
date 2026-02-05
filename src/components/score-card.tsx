"use client";

import type { CategoryScore } from "@/lib/types";

const colorClasses: Record<CategoryScore["color"], { bg: string; text: string; border: string; ring: string }> = {
  green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", ring: "stroke-green-500" },
  lime: { bg: "bg-lime-50", text: "text-lime-700", border: "border-lime-200", ring: "stroke-lime-500" },
  yellow: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", ring: "stroke-yellow-500" },
  orange: { bg: "bg-orange-50", text: "text-orange-700", border: "border-orange-200", ring: "stroke-orange-500" },
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", ring: "stroke-red-500" },
};

function CircleScore({ score, color, size = 80, noData }: { score: number; color: CategoryScore["color"]; size?: number; noData?: boolean }) {
  const c = noData ? colorClasses.yellow : colorClasses[color];
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = noData ? 0 : (score / 100) * circumference;

  return (
    <svg width={size} height={size} className="block">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="currentColor"
        className="text-muted/20"
        strokeWidth={4}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        className={c.ring}
        strokeWidth={4}
        strokeDasharray={circumference}
        strokeDashoffset={circumference - progress}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dy="0.35em"
        className={`${noData ? "text-muted-foreground" : c.text} font-bold`}
        fontSize={noData ? size * 0.22 : size * 0.28}
      >
        {noData ? "N/A" : score}
      </text>
    </svg>
  );
}

export function OverallScoreCard({ score, color }: { score: number; color: CategoryScore["color"] }) {
  const c = colorClasses[color];
  const label =
    score >= 90 ? "Mükemmel" :
    score >= 70 ? "İyi" :
    score >= 50 ? "Orta" :
    score >= 30 ? "Zayıf" : "Kritik";

  return (
    <div className={`flex flex-col items-center gap-3 p-6 rounded-2xl border ${c.bg} ${c.border}`}>
      <CircleScore score={score} color={color} size={120} />
      <div className="text-center">
        <p className={`text-lg font-bold ${c.text}`}>{label}</p>
        <p className="text-sm text-muted-foreground">Genel Skor</p>
      </div>
    </div>
  );
}

export function CategoryScoreCard({ category }: { category: CategoryScore }) {
  const c = category.noData ? colorClasses.yellow : colorClasses[category.color];

  return (
    <div className={`flex flex-col items-center gap-2 p-4 rounded-xl border ${c.bg} ${c.border}`}>
      <CircleScore score={category.score} color={category.color} size={72} noData={category.noData} />
      <p className="text-sm font-medium text-center">{category.label}</p>
    </div>
  );
}

export function CategoryDetailCard({ category }: { category: CategoryScore }) {
  const c = category.noData ? colorClasses.yellow : colorClasses[category.color];

  return (
    <div className={`p-4 rounded-xl border ${c.border} bg-background`}>
      <div className="flex items-center gap-3 mb-3">
        <CircleScore score={category.score} color={category.color} size={48} noData={category.noData} />
        <div>
          <p className="font-semibold">{category.label}</p>
          <p className={`text-sm font-medium ${category.noData ? "text-muted-foreground" : c.text}`}>
            {category.noData ? "Veri alınamadı" : `${category.score}/100`}
          </p>
        </div>
      </div>
      {category.details.length > 0 && (
        <ul className="space-y-1">
          {category.details.map((detail, i) => (
            <li key={i} className="text-sm text-muted-foreground pl-3 border-l-2 border-muted">
              {detail}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
