import { MenuTab } from "@/components/admin/MenuTab";
import { AdminSectionsTab } from "@/components/admin/AdminSectionsTab";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// Seção "Menu e abas": o menu lateral do site e a organização das seções do
// próprio Painel Admin, lado a lado (eram duas abas separadas).
export function EquipeMenuTab({ defaultTab = "menu" }: { defaultTab?: "menu" | "organizacao" } = {}) {
  return (
    <Tabs defaultValue={defaultTab}>
      <TabsList>
        <TabsTrigger value="menu">Menu do site</TabsTrigger>
        <TabsTrigger value="organizacao">Organização do Admin</TabsTrigger>
      </TabsList>
      <TabsContent value="menu" className="mt-4"><MenuTab /></TabsContent>
      <TabsContent value="organizacao" className="mt-4"><AdminSectionsTab /></TabsContent>
    </Tabs>
  );
}
