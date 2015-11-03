package com.atomizesoftware.gartnerbarcelona2015.data

import com.atomizesoftware.spin.SpinApp
import com.atomizesoftware.spin.models._
import scala.slick.jdbc.JdbcBackend._

case class DataAccess(app: SpinApp) extends com.atomizesoftware.spin.data.dao.DAO[Movement](app.dataModel) {

  import app._

  /** Gets the EXECUTE_ATTENDEE_DEMO movement of the order with the specified id,
    * if one exists.
    *
    * @param id, order id to which to check for the EXECUTE_ATTENDEE_DEMO movement.
    * @return a movement if one was found, None otherwise
    */
  def executeAttendeeDemoForOrder(id: Long)(implicit s: Session): Option[Movement] = {
    movementDAO.movementWhereTypeAndOrderIdEqual("EXECUTE_ATTENDEE_DEMO", id)
  }

  /** Gets the ATTENDEE_DEMO_STARTED movement of the order with the specified id,
    * if one exists.
    *
    * @param id, order id to which to check for the ATTENDEE_DEMO_STARTED movement.
    * @return a movement if one was found, None otherwise
    */
  def startDemoForOrder(id: Long)(implicit s: Session): Option[Movement] = {
    movementDAO.movementWhereTypeAndOrderIdEqual("ATTENDEE_DEMO_STARTED", id)
  }
}

