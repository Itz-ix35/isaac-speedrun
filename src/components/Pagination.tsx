import { ChevronLeft, ChevronRight } from "lucide-react";

type Props = {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
};

export default function Pagination({ page, pageCount, onPageChange }: Props) {
  return (
    <div className="pagination">
      <button type="button" onClick={() => onPageChange(page - 1)} disabled={page <= 1} title="上一页">
        <ChevronLeft size={18} />
      </button>
      <span>
        {page} / {pageCount}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={page >= pageCount}
        title="下一页"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}
