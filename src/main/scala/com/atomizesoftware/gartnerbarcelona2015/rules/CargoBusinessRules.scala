package com.atomizesoftware.gartnerbarcelona2015.rules

import com.atomizesoftware.spin.auth.AuthenticatedUser
import com.atomizesoftware.spin.models._
import com.atomizesoftware.spin.SpinApp
import org.slf4j.LoggerFactory
import scala.slick.jdbc.JdbcBackend._

case class CargoBusinessRules(app: SpinApp) {

  import app._
  import app.cargoManager._

  val logger = LoggerFactory.getLogger(getClass)

  /** Called in order to update a cargo that has to be Tracked.
    *
    * @param cargo, the cargo to be tracked.
    * @param location, the location in which the tracking occurred.
    * @param parentContainer, the parent container of the cargo.
    * @return the updated cargo.
    */
  def track(cargo: Option[Cargo], location: Option[Location], parentContainer: Option[Container])
           (implicit s: Session, currentUser: AuthenticatedUser): Option[Cargo] = {

    val cargoToChange: Option[Cargo] = for {
      crg <- cargo
    } yield crg.copy(
      locationId = location.map(_.id) orElse parentContainer.flatMap(_.locationId) orElse crg.locationId,
      itemStatusId = location.flatMap(_.itemStatusId) getOrElse crg.itemStatusId,
      parentId = if (crg.parentId.isDefined && parentContainer.isEmpty) None else parentContainer.map(_.id),
      quantity = if (crg.cargoTypeId == 1) Some(crg.quantity.getOrElse(0) - 1) else crg.quantity
    )

    cargoToChange.flatMap { c =>
      if (updateCargo(c)) {
        logger.info("Tracked cargo: " + c.id)
        cargoRepository.cargoWithId(c.id)
      }
      else {
        logger.info("Tracking of cargo: " + c.id + " not performed")
        None
      }
    }
  }
}
