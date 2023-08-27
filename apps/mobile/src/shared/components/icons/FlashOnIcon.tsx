import { Path } from 'react-native-svg';

import { SvgIcon, SvgIconProps } from './SvgIcon';

export function FlashOnIcon(props: SvgIconProps) {
  return (
    // <SvgIcon {...props} viewBox="0 0 24 24">
    //   <Path
    //     fillRule="evenodd"
    //     d="M14.615 1.595a.75.75 0 0 1 .359.852L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262l-10.5 11.25a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262l10.5-11.25a.75.75 0 0 1 .913-.143z"
    //     clipRule="evenodd"
    //   />
    // </SvgIcon>
    <SvgIcon {...props} fill="currentColor" stroke="currentColor" viewBox="0 0 583 583">
      <Path d="m318.284 385.185-156.348-46.646c-5.055-1.508-7.778-6.749-6.458-11.587a9.59 9.59 0 0 1 .818-2.037L312.645 35.972c4.692-8.67 17.855-5.338 17.855 4.521v335.588c0 6.358-6.124 10.921-12.216 9.104Z" />
      <Path d="m263.716 199.315 156.348 46.646c5.055 1.508 7.778 6.749 6.458 11.587a9.59 9.59 0 0 1-.818 2.037L269.355 548.528c-4.692 8.671-17.855 5.338-17.855-4.521V208.419c0-6.358 6.124-10.921 12.216-9.104Z" />
    </SvgIcon>
  );
}
