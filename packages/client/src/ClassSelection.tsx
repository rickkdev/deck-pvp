import type { ClassId } from "@deck-pvp/shared";

interface ClassSelectionProps {
  onSelectClass: (classId: ClassId) => void;
  waitingForOpponent: boolean;
  selectedClass: ClassId | null;
}

const CLASSES: {
  id: ClassId;
  name: string;
  description: string;
  mechanic: string;
  color: string;
  bgColor: string;
  borderColor: string;
  glowColor: string;
  icon: string;
}[] = [
  {
    id: "warrior",
    name: "Warrior",
    description: "Strength-based fighter. Buffs attack power and deals heavy damage.",
    mechanic: "Strength — increases damage dealt by Attack cards",
    color: "text-red-400",
    bgColor: "bg-red-950/40",
    borderColor: "border-red-700/50 hover:border-red-500",
    glowColor: "hover:shadow-red-600/20",
    icon: "⚔️",
  },
  {
    id: "rogue",
    name: "Rogue",
    description: "Fast and evasive. Plays many cheap cards and applies poison.",
    mechanic: "Poison — deals damage at start of opponent's turn, decreasing by 1",
    color: "text-green-400",
    bgColor: "bg-green-950/40",
    borderColor: "border-green-700/50 hover:border-green-500",
    glowColor: "hover:shadow-green-600/20",
    icon: "🗡️",
  },
  {
    id: "mage",
    name: "Mage",
    description: "Arcane spellcaster. Uses orbs and channeled effects for sustained damage.",
    mechanic: "Channeling — orbs that passively trigger effects each turn",
    color: "text-blue-400",
    bgColor: "bg-blue-950/40",
    borderColor: "border-blue-700/50 hover:border-blue-500",
    glowColor: "hover:shadow-blue-600/20",
    icon: "🔮",
  },
];

export default function ClassSelection({
  onSelectClass,
  waitingForOpponent,
  selectedClass,
}: ClassSelectionProps) {
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center gap-8 px-4">
      <h2 className="text-3xl font-bold text-white">Choose Your Class</h2>

      {waitingForOpponent ? (
        <>
          <p className="text-gray-400 text-lg">
            You chose{" "}
            <span className="font-semibold text-purple-300 capitalize">
              {selectedClass}
            </span>
          </p>
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-purple-300 text-lg">
              Waiting for opponent to choose...
            </span>
          </div>
        </>
      ) : (
        <>
          <p className="text-gray-400">Select a class to begin battle</p>
          <div className="flex gap-6 flex-wrap justify-center">
            {CLASSES.map((cls) => (
              <button
                key={cls.id}
                onClick={() => onSelectClass(cls.id)}
                className={`w-64 p-6 rounded-xl border-2 ${cls.borderColor} ${cls.bgColor} transition-all duration-200 shadow-lg ${cls.glowColor} hover:scale-105 cursor-pointer text-left flex flex-col gap-3`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{cls.icon}</span>
                  <h3 className={`text-xl font-bold ${cls.color}`}>
                    {cls.name}
                  </h3>
                </div>
                <p className="text-gray-300 text-sm">{cls.description}</p>
                <p className="text-gray-500 text-xs italic">{cls.mechanic}</p>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
