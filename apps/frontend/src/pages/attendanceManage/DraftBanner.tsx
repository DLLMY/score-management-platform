interface DraftBannerProps {
  handleRestoreDraft: () => void;
  handleDiscardDraft: () => void;
}

export default function DraftBanner({ handleRestoreDraft, handleDiscardDraft }: DraftBannerProps) {
  return (
    <div className='px-6 pt-5'>
      <div className='flex items-center justify-between gap-3 px-4 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-sm'>
        <span className='text-amber-800'>检测到上次未提交的内容，是否恢复？</span>
        <div className='flex items-center gap-2'>
          <button
            onClick={handleRestoreDraft}
            className='px-3 py-1 rounded-md bg-amber-500 text-white hover:bg-amber-600 text-xs'
          >
            恢复
          </button>
          <button
            onClick={handleDiscardDraft}
            className='px-3 py-1 rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100 text-xs'
          >
            放弃
          </button>
        </div>
      </div>
    </div>
  );
}
