import { getPasswordStrength } from '@/shared/validation';

type PasswordStrengthMeterProps = {
  password: string;
  weakLabel?: string;
  mediumLabel?: string;
  strongLabel?: string;
  titleLabel?: string;
};

export default function PasswordStrengthMeter({
  password,
  weakLabel = 'Weak',
  mediumLabel = 'Medium',
  strongLabel = 'Strong',
  titleLabel = 'Password strength',
}: PasswordStrengthMeterProps) {
  const { score, level } = getPasswordStrength(password);

  const currentLabel =
    level === 'strong' ? strongLabel : level === 'medium' ? mediumLabel : weakLabel;

  const barColor =
    level === 'strong'
      ? 'bg-emerald-500'
      : level === 'medium'
        ? 'bg-amber-500'
        : 'bg-red-500';

  const widthClass = score <= 1 ? 'w-1/4' : score === 2 ? 'w-2/4' : score === 3 ? 'w-3/4' : 'w-full';

  if (!password) return null;

  return (
    <div className="mt-2">
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-gray-500">{titleLabel}</span>
        <span
          className={`font-medium ${
            level === 'strong' ? 'text-emerald-600' : level === 'medium' ? 'text-amber-600' : 'text-red-600'
          }`}
        >
          {currentLabel}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full ${barColor} ${widthClass} transition-all duration-300`} />
      </div>
    </div>
  );
}
