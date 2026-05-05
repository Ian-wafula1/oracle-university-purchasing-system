import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface SlideOverProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
}

export const SlideOver = ({ open, onOpenChange, title, children }: SlideOverProps) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
      </DialogHeader>
      {children}
    </DialogContent>
  </Dialog>
);
