import { NgModule } from '@angular/core'
import { IonicModule } from '@ionic/angular'
import { NotificationDetailComponent } from '@pages/notification-detail/notification-detail.component'
import FirebaseUtils from './FirebaseUtils'
import { CommonModule } from '@angular/common'

@NgModule({
	imports: [IonicModule, CommonModule, NotificationDetailComponent],
	providers: [FirebaseUtils],
})
export class FirebaseUtilsModule {}
