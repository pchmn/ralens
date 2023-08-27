import { Path } from 'react-native-svg';

import { SvgIcon, SvgIconProps } from './SvgIcon';

export function FlashOffIcon(props: SvgIconProps) {
  return (
    // <SvgIcon {...props} viewBox="0 0 24 24">
    //   <Path d="m20.798 11.012-3.188 3.416L9.462 6.28l4.24-4.542a.75.75 0 0 1 1.272.71L12.982 9.75h7.268a.75.75 0 0 1 .548 1.262zM3.202 12.988 6.39 9.572l8.148 8.148-4.24 4.542a.75.75 0 0 1-1.272-.71l1.992-7.302H3.75a.75.75 0 0 1-.548-1.262zM3.53 2.47a.75.75 0 0 0-1.06 1.06l18 18a.75.75 0 1 0 1.06-1.06l-18-18z" />
    // </SvgIcon>
    <SvgIcon {...props} viewBox="0 0 583 583">
      <Path stroke="currentColor" strokeLinecap="round" strokeWidth={50} d="m162 113 290 290" />
      <Path
        fill="currentColor"
        fillRule="evenodd"
        d="M333.003 38.016c0-10.378-13.857-13.886-18.795-4.759L223.06 201.704l152.614 152.614 52.472-96.972c3.02-5.581.145-12.527-5.936-14.342l-89.207-26.614V38.016Zm17.843 362.185L198.232 247.587l-40.373 74.612c-3.02 5.581-.145 12.528 5.936 14.342l89.208 26.614v178.374c0 10.378 13.856 13.887 18.795 4.759l79.048-146.087Z"
        clipRule="evenodd"
      />
    </SvgIcon>
  );
}
