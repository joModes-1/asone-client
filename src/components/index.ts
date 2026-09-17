/**
 * Shared, presentational, business-logic-free.
 *
 * Nothing here fetches, and nothing here knows what a SKU or an access
 * matrix is. If a component needs to decide something, that decision belongs
 * in `domain/` and arrives as a prop.
 */

export { Alert } from './Alert'
export { Avatar } from './Avatar'
export { Badge, type IdentityTone, type Tone } from './Badge'
export { BrandMark } from './BrandMark'
export { Button } from './Button'
export { ConfirmButton } from './ConfirmButton'
export { EmptyState } from './EmptyState'
export { LineChart, type LineSeries } from './LineChart'
export { LoadingScreen } from './LoadingScreen'
export { Modal } from './Modal'
export { OtpInput } from './OtpInput'
export { PageDots } from './PageDots'
export { Pagination } from './Pagination'
export { pageWindow } from './pageWindow'
export { Panel } from './Panel'
export { PasswordField } from './PasswordField'
export { Select } from './Select'
export { SplitButton, type SplitButtonOption } from './SplitButton'
export { Skeleton, SkeletonRows, SkeletonText } from './Skeleton'
export { ServerUnreachable } from './ServerUnreachable'
export { Spinner } from './Spinner'
export { StatCard } from './StatCard'
export { TabBar, type Tab } from './TabBar'
export { TextField } from './TextField'
export { SnackbarProvider } from './snackbar/SnackbarProvider'
export { snackbar, pushSnackbar, type SnackbarTone } from './snackbar/snackbarBus'
