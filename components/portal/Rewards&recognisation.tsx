"use client";

import { useMemo, useState } from "react";

import {
  Award,
  Trophy,
  Star,
  Medal,
  Search,
  CalendarDays,
  User,
  Gift,
  ChevronRight,
} from "lucide-react";

import { Employee } from "@/lib/types";

interface RewardsRecognitionProps {
  employee: Employee;
}

type Reward = {
  id: number;
  title: string;
  category: string;
  description: string;
  awardedBy: string;
  date: string;
  points: number;
  icon: "trophy" | "star" | "medal" | "award";
};

const rewards: Reward[] = [
  {
    id: 1,
    title: "Employee of the Month",
    category: "Performance",
    description:
      "Recognized for outstanding performance, dedication and consistent contribution to the team.",
    awardedBy: "HR Department",
    date: "2026-09-30",
    points: 500,
    icon: "trophy",
  },
  {
    id: 2,
    title: "Best Team Player",
    category: "Teamwork",
    description:
      "Recognized for excellent collaboration and helping team members achieve project goals.",
    awardedBy: "Project Manager",
    date: "2026-09-20",
    points: 300,
    icon: "star",
  },
  {
    id: 3,
    title: "Outstanding Contribution",
    category: "Achievement",
    description:
      "Recognized for making a valuable contribution towards successful project delivery.",
    awardedBy: "Engineering Manager",
    date: "2026-09-12",
    points: 400,
    icon: "medal",
  },
  {
    id: 4,
    title: "Spot Recognition",
    category: "Recognition",
    description:
      "Recognized for taking initiative and completing an important task within the expected timeline.",
    awardedBy: "Team Lead",
    date: "2026-08-28",
    points: 200,
    icon: "award",
  },
];

function RewardIcon({
  type,
}: {
  type: Reward["icon"];
}) {
  const props = {
    size: 26,
    strokeWidth: 2,
  };

  switch (type) {
    case "trophy":
      return <Trophy {...props} />;

    case "star":
      return <Star {...props} />;

    case "medal":
      return <Medal {...props} />;

    default:
      return <Award {...props} />;
  }
}

export default function RewardsRecognition({
  employee,
}: RewardsRecognitionProps) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");

  // =========================
  // CATEGORIES
  // =========================

  const categories = useMemo(() => {
    return [
      "All",
      ...Array.from(
        new Set(
          rewards.map(
            (reward) => reward.category
          )
        )
      ),
    ];
  }, []);

  // =========================
  // FILTER REWARDS
  // =========================

  const filteredRewards = useMemo(() => {
    const searchText =
      search.toLowerCase().trim();

    return rewards.filter((reward) => {
      const matchesSearch =
        reward.title
          .toLowerCase()
          .includes(searchText) ||
        reward.description
          .toLowerCase()
          .includes(searchText) ||
        reward.awardedBy
          .toLowerCase()
          .includes(searchText);

      const matchesCategory =
        category === "All" ||
        reward.category === category;

      return (
        matchesSearch &&
        matchesCategory
      );
    });
  }, [search, category]);

  // =========================
  // TOTALS
  // =========================

  const totalPoints = rewards.reduce(
    (total, reward) =>
      total + reward.points,
    0
  );

  const totalAwards = rewards.length;

  const achievementCount =
    rewards.filter(
      (reward) =>
        reward.category === "Achievement"
    ).length;

  const latestReward =
    rewards.length > 0
      ? [...rewards].sort(
          (a, b) =>
            new Date(b.date).getTime() -
            new Date(a.date).getTime()
        )[0]
      : null;

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* =========================
            HEADER
        ========================= */}

        <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-3">

              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600">
                <Award size={25} />
              </div>

              <div>
                <h1 className="text-xl font-bold text-slate-800">
                  Rewards & Recognition
                </h1>

                <p className="text-sm text-slate-500">
                  Celebrate achievements and recognize
                  outstanding contributions
                </p>

                <p className="mt-1 text-xs font-medium text-indigo-600">
                  {employee.email || "Employee"}
                </p>
              </div>

            </div>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-3">
            <Gift
              size={20}
              className="text-indigo-600"
            />

            <div>
              <p className="text-xs text-slate-500">
                Total Reward Points
              </p>

              <p className="text-lg font-bold text-indigo-600">
                {totalPoints}
              </p>
            </div>
          </div>
        </div>

        {/* =========================
            SUMMARY CARDS
        ========================= */}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

          {/* Total Awards */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  Total Awards
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {totalAwards}
                </p>
              </div>

              <div className="rounded-xl bg-indigo-100 p-3 text-indigo-600">
                <Award size={23} />
              </div>

            </div>
          </div>

          {/* Reward Points */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  Reward Points
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {totalPoints}
                </p>
              </div>

              <div className="rounded-xl bg-amber-100 p-3 text-amber-600">
                <Star size={23} />
              </div>

            </div>
          </div>

          {/* Achievements */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div>
                <p className="text-sm text-slate-500">
                  Achievements
                </p>

                <p className="mt-1 text-2xl font-bold text-slate-800">
                  {achievementCount}
                </p>
              </div>

              <div className="rounded-xl bg-emerald-100 p-3 text-emerald-600">
                <Medal size={23} />
              </div>

            </div>
          </div>

          {/* Latest Recognition */}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">

              <div className="min-w-0">
                <p className="text-sm text-slate-500">
                  Latest Recognition
                </p>

                <p className="mt-1 truncate text-lg font-bold text-slate-800">
                  {latestReward?.title || "None"}
                </p>
              </div>

              <div className="rounded-xl bg-purple-100 p-3 text-purple-600">
                <Trophy size={23} />
              </div>

            </div>
          </div>

        </div>

        {/* =========================
            SEARCH + FILTER
        ========================= */}

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">

          <div className="flex flex-col gap-3 md:flex-row">

            <div className="relative flex-1">

              <Search
                size={19}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Search rewards and recognitions..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
              />

            </div>

            <select
              value={category}
              onChange={(event) =>
                setCategory(event.target.value)
              }
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm outline-none focus:border-indigo-400"
            >
              {categories.map((item) => (
                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>
              ))}
            </select>

          </div>
        </div>

        {/* =========================
            RECOGNITIONS
        ========================= */}

        <div className="space-y-4">

          <div className="flex items-center justify-between">

            <div>
              <h2 className="text-lg font-bold text-slate-800">
                My Recognitions
              </h2>

              <p className="text-sm text-slate-500">
                Your rewards and achievements
              </p>
            </div>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              {filteredRewards.length} Awards
            </span>

          </div>

          {filteredRewards.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white py-12 text-center">

              <Award
                size={40}
                className="mx-auto text-slate-300"
              />

              <p className="mt-3 font-medium text-slate-600">
                No recognitions found
              </p>

              <p className="mt-1 text-sm text-slate-400">
                Try changing your search or category filter.
              </p>

            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

              {filteredRewards.map(
                (reward) => (
                  <div
                    key={reward.id}
                    className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                  >

                    <div className="flex gap-4">

                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                        <RewardIcon
                          type={reward.icon}
                        />
                      </div>

                      <div className="min-w-0 flex-1">

                        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">

                          <div>

                            <h3 className="font-bold text-slate-800">
                              {reward.title}
                            </h3>

                            <span className="mt-1 inline-block rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-600">
                              {reward.category}
                            </span>

                          </div>

                          <div className="flex items-center gap-1 text-sm font-semibold text-amber-600">

                            <Star
                              size={15}
                              fill="currentColor"
                            />

                            {reward.points} pts
                          </div>

                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-500">
                          {reward.description}
                        </p>

                        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">

                          <div className="flex items-center gap-1.5">
                            <User size={14} />
                            <span>
                              Awarded by{" "}
                              {reward.awardedBy}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <CalendarDays size={14} />

                            <span>
                              {new Date(
                                reward.date
                              ).toLocaleDateString(
                                "en-IN",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </div>

                        </div>

                      </div>

                      <ChevronRight
                        size={18}
                        className="mt-2 hidden text-slate-300 transition group-hover:text-indigo-500 sm:block"
                      />

                    </div>
                  </div>
                )
              )}

            </div>
          )}

        </div>

        {/* =========================
            FOOTER MESSAGE
        ========================= */}

        <div className="rounded-2xl bg-indigo-600 p-6 text-white shadow-sm">

          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">

            <div className="flex items-start gap-4">

              <div className="rounded-xl bg-white/15 p-3">
                <Trophy size={25} />
              </div>

              <div>

                <h3 className="font-bold">
                  Keep up the great work!
                </h3>

                <p className="mt-1 text-sm text-indigo-100">
                  Every contribution matters. Your hard work
                  and achievements are valued by the organization.
                </p>

              </div>

            </div>

            <div className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-3">

              <Star size={18} />

              <span className="text-sm font-semibold">
                {totalPoints} Reward Points
              </span>

            </div>

          </div>

        </div>

      </div>
    </div>
  );
}