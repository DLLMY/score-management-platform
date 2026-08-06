import { memo, useMemo } from 'react';
import { CheckSquare, Square, Edit2, Trash2, Zap } from 'lucide-react';
import { User } from '../../types';
import { AnimatedScore, PermissionButton } from '../';

interface UserTableRowProps {
  user: User;
  isSelected: boolean;
  onToggleSelection: (userId: number) => void;
  onOpenQuickScore: (user: User) => void;
  onOpenEdit: (user: User) => void;
  onDelete: (userId: number) => void;
}

const UserTableRow = memo<UserTableRowProps>(
  ({ user, isSelected, onToggleSelection, onOpenQuickScore, onOpenEdit, onDelete }) => {
    const userId = useMemo(() => Number(user.id), [user.id]);

    return (
      <tr
        className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
      >
        <td className="px-4 py-3">
          <button
            onClick={() => onToggleSelection(userId)}
            className="p-1 hover:bg-gray-100 rounded transition-colors"
          >
            {isSelected ? (
              <CheckSquare className="w-5 h-5 text-primary-500" />
            ) : (
              <Square className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center">
            <div className="flex-shrink-0 h-10 w-10">
              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white font-medium">
                {user.name.charAt(0)}
              </div>
            </div>
            <div className="ml-4">
              <div className="text-sm font-medium text-gray-900">{user.name}</div>
              <div className="text-sm text-gray-500">{user.card_id}</div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            {user.class_name}
          </span>
        </td>
        <td className="px-4 py-3">
          <AnimatedScore value={user.score || 0} />
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <PermissionButton
              permission="score.entry"
              size="sm"
              variant="secondary"
              onClick={() => onOpenQuickScore(user)}
            >
              <Zap className="w-3 h-3 mr-1" />
              评分
            </PermissionButton>
            <PermissionButton
              permission="student.manage"
              size="sm"
              variant="secondary"
              onClick={() => onOpenEdit(user)}
            >
              <Edit2 className="w-3 h-3 mr-1" />
              编辑
            </PermissionButton>
            <PermissionButton
              permission="student.delete"
              size="sm"
              variant="danger"
              onClick={() => onDelete(userId)}
            >
              <Trash2 className="w-3 h-3 mr-1" />
              删除
            </PermissionButton>
          </div>
        </td>
      </tr>
    );
  },
  (prevProps, nextProps) => {
    return (
      prevProps.user.id === nextProps.user.id &&
      prevProps.user.score === nextProps.user.score &&
      prevProps.isSelected === nextProps.isSelected
    );
  }
);

UserTableRow.displayName = 'UserTableRow';

export default UserTableRow;