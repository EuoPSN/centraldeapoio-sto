import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { listUsers, promoteUser, setUserActive, createUser, resetUserPassword, deleteUser, updateUserBirthdate, updateUserDisplayName } from "@/lib/users.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Trash2, UserPlus, Users } from "lucide-react";

export function UsersTab() {
  const list = useServerFn(listUsers);
  const promote = useServerFn(promoteUser);
  const active = useServerFn(setUserActive);
  const create = useServerFn(createUser);
  const reset = useServerFn(resetUserPassword);
  const del = useServerFn(deleteUser);
  const setBirthdate = useServerFn(updateUserBirthdate);
  const setDisplayName = useServerFn(updateUserDisplayName);
  const qc = useQueryClient();
  const usersQ = useQuery({ queryKey: ["admin-users"], queryFn: () => list({}) });

  const [openNew, setOpenNew] = useState(false);
  const [newU, setNewU] = useState({ email: "", password: "", displayName: "", role: "funcionario" as "admin" | "funcionario", dataNascimento: "" });

  const birthdateMut = useMutation({
    mutationFn: (v: { userId: string; dataNascimento: string | null }) => setBirthdate({ data: v }),
    onSuccess: () => { toast.success("Data de nascimento salva."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const displayNameMut = useMutation({
    mutationFn: (v: { userId: string; displayName: string }) => setDisplayName({ data: v }),
    onSuccess: () => { toast.success("Nome atualizado."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  const promoteMut = useMutation({
    mutationFn: (v: { userId: string; role: "admin" | "funcionario" }) => promote({ data: v }),
    onSuccess: () => { toast.success("Papel atualizado."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const activeMut = useMutation({
    mutationFn: (v: { userId: string; isActive: boolean }) => active({ data: v }),
    onSuccess: () => { toast.success("Status atualizado."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const createMut = useMutation({
    mutationFn: () => create({ data: { ...newU, dataNascimento: newU.dataNascimento || null } }),
    onSuccess: () => { toast.success("Usuário criado."); setOpenNew(false); setNewU({ email: "", password: "", displayName: "", role: "funcionario", dataNascimento: "" }); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const resetMut = useMutation({
    mutationFn: (v: { userId: string; newPassword: string }) => reset({ data: v }),
    onSuccess: () => toast.success("Senha redefinida."),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });
  const deleteMut = useMutation({
    mutationFn: (userId: string) => del({ data: { userId } }),
    onSuccess: () => { toast.success("Usuário excluído."); qc.invalidateQueries({ queryKey: ["admin-users"] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro"),
  });

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2"><Users className="h-4 w-4 text-gold-text" /> Usuários ({usersQ.data?.length ?? 0})</h3>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><UserPlus className="h-4 w-4" /> Novo usuário</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Criar novo usuário</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Nome</Label><Input value={newU.displayName} onChange={(e) => setNewU({ ...newU, displayName: e.target.value })} /></div>
              <div><Label>E-mail</Label><Input type="email" value={newU.email} onChange={(e) => setNewU({ ...newU, email: e.target.value })} /></div>
              <div><Label>Senha temporária</Label><Input type="text" value={newU.password} onChange={(e) => setNewU({ ...newU, password: e.target.value })} /></div>
              <div>
                <Label>Papel</Label>
                <Select value={newU.role} onValueChange={(v) => setNewU({ ...newU, role: v as "admin" | "funcionario" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="funcionario">Funcionário</SelectItem>
                    <SelectItem value="admin">Administrador</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data de nascimento (opcional)</Label>
                <Input type="date" value={newU.dataNascimento} onChange={(e) => setNewU({ ...newU, dataNascimento: e.target.value })} />
              </div>
            </div>
            <DialogFooter>
              <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Usuário</TableHead>
            <TableHead>Papel</TableHead>
            <TableHead>Aniversário</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {[...(usersQ.data ?? [])].sort((a: any, b: any) => Number(a.is_active) - Number(b.is_active)).map((u: any) => {
            const isAdmin = u.roles.includes("admin");
            return (
              <TableRow key={u.id}>
                <TableCell>
                  <Input defaultValue={u.display_name || ""} placeholder={u.email} className="h-8 text-sm font-medium mb-0.5"
                    onBlur={(e) => { if (e.target.value.trim() && e.target.value !== u.display_name) displayNameMut.mutate({ userId: u.id, displayName: e.target.value.trim() }); }} />
                  <div className="text-xs text-muted-foreground">{u.email}</div>
                </TableCell>
                <TableCell>
                  <Badge variant={isAdmin ? "default" : "secondary"}>{isAdmin ? "Admin" : "Funcionário"}</Badge>
                </TableCell>
                <TableCell>
                  <Input type="date" defaultValue={u.data_nascimento ?? ""} className="h-8 w-36 text-xs"
                    onBlur={(e) => birthdateMut.mutate({ userId: u.id, dataNascimento: e.target.value || null })} />
                </TableCell>
                <TableCell>
                  <Badge variant={u.is_active ? "outline" : "destructive"}>{u.is_active ? "Ativo" : "Bloqueado"}</Badge>
                </TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="outline" onClick={() => promoteMut.mutate({ userId: u.id, role: isAdmin ? "funcionario" : "admin" })}>
                    {isAdmin ? "Rebaixar" : "Promover"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => activeMut.mutate({ userId: u.id, isActive: !u.is_active })}>
                    {u.is_active ? "Bloquear" : "Reativar"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => {
                    const pwd = prompt("Nova senha (mín. 8 caracteres):");
                    if (pwd && pwd.length >= 8) resetMut.mutate({ userId: u.id, newPassword: pwd });
                  }}>
                    Resetar senha
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    title="Excluir usuário"
                    disabled={deleteMut.isPending}
                    onClick={() => {
                      if (confirm(`Excluir permanentemente ${u.display_name || u.email}? Esta ação não pode ser desfeita.`)) {
                        deleteMut.mutate(u.id);
                      }
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
