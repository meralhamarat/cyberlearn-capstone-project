"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  User, 
  BookOpen, 
  Settings, 
  LogOut, 
  ShieldAlert,
  Gamepad2
} from "lucide-react";

// 1. ADIM: Rolleri kesin olarak tanımla (TypeScript hatasını bitirir)
type UserRole = "admin" | "teacher" | "student";

// 2. ADIM: Menü yapısını dışarıda (statik) tanımla
const ALL_MENU_ITEMS = [
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["admin", "teacher"] },
  { name: "Siber Harita", href: "/dashboard/student", icon: BookOpen, roles: ["student"] },
  { name: "Operasyon (Oyun)", href: "/game", icon: Gamepad2, roles: ["student"] },
  { name: "Profilim", href: "/dashboard/profile", icon: User, roles: ["admin", "teacher", "student"] },
  { name: "Sistem Kontrol", href: "/dashboard/admin-tools", icon: ShieldAlert, roles: ["admin"] },
];

export default function SideBar() {
  const pathname = usePathname();
  
  // 3. ADIM: Gerçek rolü al (Şimdilik test için değiştir, sunumda buradan tek hamleyle değişir)
  const userRole: UserRole = "admin"; 

  // 4. ADIM: Filtreleme Mantığı (Bu kısım "geçici" if bloklarını ortadan kaldırır)
  const filteredNavItems = ALL_MENU_ITEMS.filter((item) => 
    item.roles.includes(userRole)
  );

  return (
    <div className="flex flex-col h-full py-6 px-4">
      {/* Logo Alanı */}
      <div className="mb-10 px-2">
        <h2 className="text-2xl font-black tracking-tighter text-[#39ff14] italic">
          CYBER<span className="text-white">LEARN</span>
        </h2>
        <div className="h-1 w-12 bg-[#39ff14] mt-1 shadow-[0_0_10px_#39ff14]"></div>
      </div>

      {/* Navigasyon Linkleri */}
      <nav className="flex-1 space-y-2">
        {filteredNavItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-300 group ${
                isActive 
                  ? "bg-[#39ff14]/10 text-[#39ff14] border-l-4 border-[#39ff14]" 
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <item.icon 
                size={20} 
                className={isActive ? "text-[#39ff14]" : "group-hover:text-[#39ff14]"} 
              />
              <span className="font-medium tracking-wide">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      {/* Alt Kısım */}
      <div className="mt-auto pt-6 border-t border-white/10 space-y-2">
        <button className="flex items-center gap-3 px-4 py-3 w-full text-red-500 hover:bg-red-500/10 rounded-lg transition-colors group">
          <LogOut size={20} className="group-hover:animate-pulse" />
          <span>Bağlantıyı Kes</span>
        </button>
      </div>
    </div>
  );
}