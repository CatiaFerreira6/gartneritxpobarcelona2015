package com.atomizesoftware.gartnerbarcelona2015

import com.atomizesoftware.spin.SpinApp
import com.atomizesoftware.spin.auth.AuthenticatedUser
import com.atomizesoftware.spin.models._
import com.atomizesoftware.spin.util.InternalErrorException
import com.github.nscala_time.time.Imports._
import org.slf4j.LoggerFactory
import scala.slick.jdbc.JdbcBackend._
import scala.util.{Failure, Try, Success}

import com.atomizesoftware.gartnerbarcelona2015.rules._
import com.atomizesoftware.gartnerbarcelona2015.data._

case class GartnerBarcelona2015(spin: SpinApp) {

  import spin._

  val logger = LoggerFactory.getLogger(getClass)

  val dataAccess = DataAccess(spin)
  val containerBusinessRules = ContainerBusinessRules(spin)
  val cargoBusinessRules = CargoBusinessRules(spin)
  val movementBusinessRules = MovementBusinessRules(spin, dataAccess, containerBusinessRules, cargoBusinessRules)

  /** Extension point that is called after a cargo is created.
    *
    * We only catch this event to Notify devices that there was a change with cargos.
    * (this will no longer be needed if future releases of Spin as it will be done automatically)
    */
  def cargoManager_afterInsert(cargo: Try[Option[Cargo]],extraParams: Map[String, Any], session: Session, user: AuthenticatedUser): Try[Option[Cargo]] = {
    cargo match {
      case Success(crg) => crg match {
        case Some(c) =>
          deviceManager.notifyDevicesTo(SyncCargos)
          cargo
        case None => Success(None)
      }
      case Failure(ex) => Failure(ex)
    }
  }

  /** Extension point that is called after a cargo is updated.
    *
    * We only catch this event to Notify devices that there was a change with cargos.
    * (this will no longer be needed if future releases of Spin as it will be done automatically)
    */
  def cargoManager_afterUpdate(cargo: Try[Option[Cargo]], extraParams: Map[String, Any], session: Session, user: AuthenticatedUser): Try[Option[Cargo]] = {
    cargo match {
      case Success(crg) => crg match {
        case Some(c) =>
          deviceManager.notifyDevicesTo(SyncCargos)
          cargo
        case None => Success(None)
      }
      case Failure(ex) => Failure(ex)
    }
  }

  /** Extension point that is called after a container is created.
    *
    * We only catch this event to Notify devices that there was a change with containers.
    * (this will no longer be needed if future releases of Spin as it will be done automatically)
    */
  def containerManager_afterInsert(container: Try[Option[Container]], extraParams: Map[String, Any], session: Session, user: AuthenticatedUser): Try[Option[Container]] = {
    container match {
      case Success(cnt) => cnt match {
        case Some(c) =>
          deviceManager.notifyDevicesTo(SyncContainers)
          container
        case None => Success(None)
      }
      case Failure(ex) => Failure(ex)
    }
  }

  /** Extension point that is called after a container is updated.
    *
    * We catch this event to perform logic based on changes to the container.
    *
    * @param container, with the changes.
    * @param extraParams, contains "oldContainer" parameter that is an Option[Container] that represents
    *                   the container before the update.
    */
  def containerManager_afterUpdate(container: Try[Option[Container]], extraParams: Map[String, Any], session: Session, user: AuthenticatedUser): Try[Option[Container]] = {
    container match {
      case Success(cnt) => cnt match {
        case Some(c) => containerBusinessRules.processContainerAfterUpdate(c)(session, user)
        case None => Success(None)
      }
      case Failure(ex) => Failure(ex)
    }
  }

  /** Extension point that is called before a movement is created.
    *
    * We catch this event in order to perform specific logic that changes the movement
    * before it is created in the database.
    *
    */
  def movementManager_beforeInsert(movement: Try[Option[Movement]], extraParams: Map[String, Any], session: Session, user: AuthenticatedUser): Try[Option[Movement]] = {
    movement match {
      case Success(mov) => mov match {
        case Some(m) => movementBusinessRules.beforeMovementIsCreated(m, extraParams)(session, user)
        case None => Success(None)
      }
      case Failure(ex) => Failure(ex)
    }
  }

  /** Extension point that is called after a movement is created.
    *
    * We catch this event to perform specific logic regarding the movement that was just created.
    *
    */
  def movementManager_afterInsert(movement: Try[Option[Movement]], extraParams: Map[String, Any], session: Session, user: AuthenticatedUser): Try[Option[Movement]] = {
    movement match {
      case Success(mov) => mov match {
        case Some(m) => movementBusinessRules.afterMovementIsCreated(m)(session, user)
        case None => Success(None)
      }
      case Failure(ex) => Failure(ex)
    }
  }

  /** Extension point that is called after an order is updated.
    *
    * We catch this event in order to update the EXECUTE_ATTENDEE_DEMO movement
    * according to info that was changed in the order if the order is of type Welcome Attendee.
    *
    * We also tell the devices that there were changes made to Orders
    * (this will no longer be needed if future releases of Spin as it will be done automatically)
    */
  def orderManager_afterUpdate(order: Try[Option[Order]], extraParams: Map[String, Any], session: Session, user: AuthenticatedUser): Try[Option[Order]] = {
    implicit val currentSession = session
    implicit val currentUser = user
    implicit val orderRepo = orderRepository

    order match {
      case Success(ord) => ord match {
        case Some(orderAfterUpdate) => {
          orderAfterUpdate.orderType match {
            case Some(orderType) if orderType.code == "WELCOME_ATTENDEE" =>
              dataAccess.executeAttendeeDemoForOrder(orderAfterUpdate.id) match {
                case Some(mov) => movementManager.updateMovement(mov.copy(
                  assignedUserId = orderAfterUpdate.assignedUserId,
                  assignedGroupId = orderAfterUpdate.assignedGroupId,
                  destinationLocationId = orderAfterUpdate.destinationLocationId,
                  originLocationId = orderAfterUpdate.originLocationId,
                  serviceLevelAgreementId = orderAfterUpdate.serviceLevelAgreementId,
                  startDateTime = orderAfterUpdate.plannedStartDateTime
                ))
                case None => throw InternalErrorException("No execute attendee demo movement for updated order")
              }

              deviceManager.notifyDevicesTo(AskForNewMovements)
            case _ => logger.info("Order not of type WELCOME_ATTENDEE, no processing to be done.")
          }
          deviceManager.notifyDevicesTo(SyncOrders)
          Success(Some(orderAfterUpdate))
        }
        case None => Success(None)
      }
      case Failure(ex) => Failure(ex)
    }
  }
}
