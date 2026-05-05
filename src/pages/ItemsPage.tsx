import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getItems, createItem, updateItem, deleteItem } from '@/api/items';
import { TopBar } from '@/components/TopBar';
import { PageHeader } from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';
import { SlideOver } from '@/components/SlideOver';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Search, Pencil, Trash2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';

const ItemsPage = () => {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Record<string, unknown> | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<number | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['items'], queryFn: () => getItems() });
  const items = (data?.items || data || []) as Record<string, unknown>[];
  const categories = (data?.categories || [...new Set(items.map(i => i.Category))].filter(Boolean)) as string[];

  const createMut = useMutation({
    mutationFn: createItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['items'] }); setShowForm(false); toast.success('Item created'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Record<string, unknown> }) => updateItem(id, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['items'] }); setEditTarget(null); toast.success('Item updated'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: deleteItem,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['items'] }); setDeleteTarget(null); toast.success('Item deleted'); },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = items
    .filter(i => String(i.ItemName || '').toLowerCase().includes(search.toLowerCase()))
    .filter(i => categoryFilter === 'All' || i.Category === categoryFilter);

  const columns: Column<Record<string, unknown>>[] = [
    { key: 'ItemName', header: 'Name' },
    { key: 'Category', header: 'Category' },
    { key: 'Unit', header: 'Unit' },
    { key: 'Description', header: 'Description' },
    {
      key: '_actions', header: 'Actions', render: (r) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); setEditTarget(r); }}><Pencil className="h-3.5 w-3.5" /></Button>
          <Button size="sm" variant="ghost" className="text-destructive" onClick={(e) => { e.stopPropagation(); setDeleteTarget(r.ItemID as number); }}><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      ),
    },
  ];

  return (
    <>
      <TopBar title="Items" />
      <div className="page-container">
        <PageHeader title="Items" breadcrumbs={['Procurement', 'Items']} action={{ label: 'Add Item', onClick: () => setShowForm(true), icon: <Plus className="h-4 w-4" /> }} />
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search items..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Categories</SelectItem>
              {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <DataTable columns={columns} data={filtered} isLoading={isLoading} />

        <SlideOver open={showForm} onOpenChange={setShowForm} title="New Item">
          <ItemForm onSubmit={(d) => createMut.mutate(d)} isPending={createMut.isPending} />
        </SlideOver>
        <SlideOver open={!!editTarget} onOpenChange={() => setEditTarget(null)} title="Edit Item">
          {editTarget && <ItemForm defaults={editTarget} onSubmit={(d) => updateMut.mutate({ id: editTarget.ItemID as number, body: d })} isPending={updateMut.isPending} />}
        </SlideOver>
        <ConfirmModal open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)} title="Delete Item" description="This cannot be undone." onConfirm={() => deleteTarget && deleteMut.mutate(deleteTarget)} confirmLabel="Delete" destructive />
      </div>
    </>
  );
};

const ItemForm = ({ defaults, onSubmit, isPending }: { defaults?: Record<string, unknown>; onSubmit: (d: Record<string, unknown>) => void; isPending: boolean }) => {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: defaults as Record<string, string> });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-2"><Label>Item Name</Label><Input {...register('ItemName', { required: 'Required' })} />{errors.ItemName && <p className="text-xs text-destructive">{String(errors.ItemName.message)}</p>}</div>
      <div className="space-y-2"><Label>Category</Label><Input {...register('Category', { required: 'Required' })} /></div>
      <div className="space-y-2"><Label>Unit</Label><Input {...register('Unit')} placeholder="e.g., pcs, kg, box" /></div>
      <div className="space-y-2"><Label>Description</Label><Textarea {...register('Description')} /></div>
      <Button type="submit" className="w-full" disabled={isPending}>{isPending ? 'Saving...' : 'Save'}</Button>
    </form>
  );
};

export default ItemsPage;
