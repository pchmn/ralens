import { Path } from 'react-native-svg';

import { SvgIcon, SvgIconProps } from './SvgIcon';

export function PeopleIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} strokeWidth={1.5} viewBox="0 0 48 48">
      <Path
        fill="currentColor"
        d="M1.9 40v-4.7c0-1.167.3-2.225.9-3.175.6-.95 1.433-1.658 2.5-2.125 2.433-1.067 4.625-1.833 6.575-2.3 1.95-.467 3.958-.7 6.025-.7s4.067.233 6 .7c1.933.467 4.117 1.233 6.55 2.3a5.627 5.627 0 0 1 2.525 2.125c.617.95.925 2.008.925 3.175V40h-32Zm35 0v-4.7c0-2.1-.533-3.825-1.6-5.175-1.067-1.35-2.467-2.442-4.2-3.275 2.3.267 4.467.658 6.5 1.175 2.033.517 3.683 1.108 4.95 1.775 1.1.633 1.967 1.417 2.6 2.35s.95 1.983.95 3.15V40h-9.2Zm-19-16.05c-2.2 0-4-.7-5.4-2.1-1.4-1.4-2.1-3.2-2.1-5.4s.7-4 2.1-5.4c1.4-1.4 3.2-2.1 5.4-2.1s4 .7 5.4 2.1c1.4 1.4 2.1 3.2 2.1 5.4s-.7 4-2.1 5.4c-1.4 1.4-3.2 2.1-5.4 2.1Zm18-7.5c0 2.2-.7 4-2.1 5.4-1.4 1.4-3.2 2.1-5.4 2.1-.367 0-.775-.025-1.225-.075a5.29 5.29 0 0 1-1.225-.275c.8-.833 1.408-1.858 1.825-3.075.417-1.217.625-2.575.625-4.075s-.208-2.825-.625-3.975A10.628 10.628 0 0 0 25.95 9.3c.367-.1.775-.183 1.225-.25.45-.067.858-.1 1.225-.1 2.2 0 4 .7 5.4 2.1 1.4 1.4 2.1 3.2 2.1 5.4Z"
      />
    </SvgIcon>
  );
}
