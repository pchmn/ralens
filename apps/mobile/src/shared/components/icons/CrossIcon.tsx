import { Path } from 'react-native-svg';

import { SvgIcon, SvgIconProps } from './SvgIcon';

export function CrossIcon(props: SvgIconProps) {
  return (
    <SvgIcon {...props} type="outline" strokeWidth={1.5} viewBox="0 0 24 24">
      <Path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </SvgIcon>
  );
}
