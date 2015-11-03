package com.atomizesoftware.gartnerbarcelona2015.rules

import com.atomizesoftware.spin.SpinApp
import com.atomizesoftware.spin.auth.AuthenticatedUser
import com.atomizesoftware.spin.models._
import com.atomizesoftware.spin.managers.ContainerExtensions._
import org.slf4j.LoggerFactory
import scala.slick.jdbc.JdbcBackend._
import scala.util.{Success, Try}

case class ContainerBusinessRules(app: SpinApp) {

  import app._
  import app.containerManager._

  val logger = LoggerFactory.getLogger(getClass)

  /**
    * Updates the location and status of the containers and cargos inside the container that was just updated.
    * Notifies the devices to sync the containers.
    *
    * @param container, the container that was just updated.
    * @return Success with a container if successful, Failure with an exception otherwise.
    */
  def processContainerAfterUpdate(container: Container)(implicit s: Session, currentUser: AuthenticatedUser): Try[Option[Container]] = {

    logger.info("Updating location an status of containers and cargos inside of: " + container.id)

    val locationItemStatusId = container.locationId match{
      case Some(locId) => locationRepository.locationWithId(locId).flatMap(_.itemStatusId)
      case _ => None
    }

    container.containersInside.fullDepth.map(containerInside => {
      updateContainer(containerInside.copy(
        locationId = container.locationId,
        itemStatusId = locationItemStatusId getOrElse containerInside.itemStatusId
      ))
    })

    container.cargosInside.fullDepth.map(cargoInside => {
      cargoManager.updateCargo(cargoInside.copy(
        locationId = container.locationId,
        itemStatusId = locationItemStatusId getOrElse cargoInside.itemStatusId
      ))
    })

    deviceManager.notifyDevicesTo(SyncContainers)
    Success(Some(container))
  }

  /** Called to process the changes for a specific container regarding a TRACKING.
    *
    * @param container, the container to track.
    * @param location, the location to take into account for the tracking.
    * @param parentContainer, the parent container of the container to track.
    * @return the updated container with the new information.
    */
  def track(container: Option[Container], location: Option[Location], parentContainer: Option[Container])
           (implicit s: Session, currentUser: AuthenticatedUser): Option[Container] = {

    val containerToChange: Option[Container] = for {
      cnt <- container
    } yield cnt.copy(
      locationId = location.map(_.id) orElse parentContainer.flatMap(_.locationId) orElse cnt.locationId,
      itemStatusId = location.flatMap(_.itemStatusId) getOrElse cnt.itemStatusId
    )

    containerToChange.flatMap { c =>
      if (updateContainer(c)){
        logger.info("Tracked container: " + c.id)
        containerRepository.containerWithId(c.id)
      }
      else {
        logger.info("Tracking of container " + c.id + " not performed")
        None
      }
    }
  }
}
