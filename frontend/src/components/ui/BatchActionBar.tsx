import { useState, useCallback, ReactNode } from 'react';
import { CheckSquare, X, MoreVertical } from 'lucide-react';
import Button from './Button';

export interface BatchAction<T = unknown> {
  id: string;
  label: string;
  icon?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger' | 'success';
  handler: (selectedItems: T[]) => void | Promise<void>;
  confirmMessage?: string;
  disabled?: (selectedItems: T[]) => boolean;
}

interface BatchActionBarProps<T = unknown> {
  selectedItems: T[];
  selectedIds: Set<string | number>;
  onClearSelection: () => void;
  actions: BatchAction<T>[];
  getItemName?: (item: T) => string;
}

function BatchActionBar<T = unknown>({
  selectedItems,
  selectedIds: _selectedIds,
  onClearSelection,
  actions,
  getItemName = (item: T) => (item as Record<string, unknown>).name as string || '项目',
}: BatchActionBarProps<T>) {
  const [showActionMenu, setShowActionMenu] = useState<boolean>(false);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);

  const handleAction = useCallback(async (action: BatchAction<T>) => {
    if (selectedItems.length === 0) return;

    if (action.confirmMessage) {
      const confirmed = window.confirm(
        `${action.confirmMessage}\n\n已选择 ${selectedItems.length} 项：\n${selectedItems.slice(0, 3).map(getItemName).join('\n')}${selectedItems.length > 3 ? '\n...' : ''}`
      );
      if (!confirmed) return;
    }

    setLoadingActionId(action.id);
    try {
      await action.handler(selectedItems);
      onClearSelection();
    } catch (error) {
      console.error('批量操作失败:', error);
    } finally {
      setLoadingActionId(null);
      setShowActionMenu(false);
    }
  }, [selectedItems, onClearSelection, getItemName]);

  const primaryActions = actions.filter(a => !a.variant || a.variant === 'primary');
  const secondaryActions = actions.filter(a => a.variant && a.variant !== 'primary');

  return (
    <div className='bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-3 mb-4 animate-in slide-in-from-top-2 duration-200'>
      <div className='flex items-center justify-between'>
        <div className='flex items-center gap-3'>
          <div className='flex items-center gap-2 text-sm font-medium text-blue-700'>
            <CheckSquare className='w-4 h-4' />
            <span>已选择 {selectedItems.length} 项</span>
          </div>
          <button
            onClick={onClearSelection}
            className='text-sm text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1'
          >
            <X className='w-3 h-3' />
            清除选择
          </button>
        </div>

        <div className='flex items-center gap-2'>
          {primaryActions.map((action) => {
            const isDisabled = action.disabled?.(selectedItems) || loadingActionId !== null;
            return (
              <Button
                key={action.id}
                variant={action.variant === 'danger' ? 'danger' : 'primary'}
                size='sm'
                onClick={() => handleAction(action)}
                disabled={isDisabled}
                className='gap-1'
              >
                {loadingActionId === action.id ? (
                  <div className='w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin' />
                ) : (
                  action.icon
                )}
                {action.label}
              </Button>
            );
          })}

          {secondaryActions.length > 0 && (
            <div className='relative'>
              <Button
                variant='secondary'
                size='sm'
                onClick={() => setShowActionMenu(!showActionMenu)}
                className='gap-1'
              >
                <MoreVertical className='w-4 h-4' />
                更多操作
              </Button>

              {showActionMenu && (
                <>
                  <div
                    className='fixed inset-0 z-10'
                    onClick={() => setShowActionMenu(false)}
                  />
                  <div className='absolute right-0 top-full mt-1 bg-white rounded-lg shadow-lg border py-1 min-w-[160px] z-20'>
                    {secondaryActions.map((action) => {
                      const isDisabled = action.disabled?.(selectedItems) || loadingActionId !== null;
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleAction(action)}
                          disabled={isDisabled}
                          className={`w-full px-4 py-2 text-left text-sm flex items-center gap-2 transition-colors ${
                            isDisabled
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          {loadingActionId === action.id ? (
                            <div className='w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin' />
                          ) : (
                            action.icon
                          )}
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default BatchActionBar;