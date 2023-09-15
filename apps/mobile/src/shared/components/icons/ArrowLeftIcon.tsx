import { Path } from 'react-native-svg';

import { SvgIcon, SvgIconProps } from './SvgIcon';

export function ArrowLeftIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} type="outline" strokeWidth={1.5} viewBox="0 0 24 24">
      <Path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
    </SvgIcon>
  );
}
