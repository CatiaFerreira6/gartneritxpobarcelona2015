package com.atomizesoftware.gartnerbarcelona2015.rules

import com.atomizesoftware.spin.SpinApp
import com.atomizesoftware.spin.auth.AuthenticatedUser
import com.atomizesoftware.spin.models._
import com.atomizesoftware.spin.managers.ContainerExtensions._
import org.slf4j.LoggerFactory
import scala.slick.jdbc.JdbcBackend._
import scala.util.{Try, Success, Failure}
import com.github.nscala_time.time.Imports._

import com.atomizesoftware.gartnerbarcelona2015.data.DataAccess

case class MovementBusinessRules(app: SpinApp, dataAccess: DataAccess,
    containerBusinessRules: ContainerBusinessRules, cargoBusinessRules: CargoBusinessRules) {

  import app._
  import app.movementManager._

  val logger = LoggerFactory.getLogger(getClass)

  def beforeMovementIsCreated(movement: Movement, extraParams: Map[String, Any])(implicit s: Session, user: AuthenticatedUser): Try[Option[Movement]] = {
    movement match {
      case mov if mov typeIs "TRACKING" => processTracking(mov)
      case mov => Success(Some(mov))
    }
  }

  def afterMovementIsCreated(movement: Movement)(implicit s: Session, user: AuthenticatedUser): Try[Option[Movement]] = {
    movement match {
      case mov if mov typeIs "REGISTERED_NEW_ATTENDEE" => processNewAttendeeDemo(mov)
      case mov if mov typeIs "ATTENDEE_DEMO_COMPLETED" => finishDemo(mov)
      case mov if mov typeIs "TRACKING" => processTrackingAfterInsert(mov)
      case mov =>
        logger.info("Movement not corresponding to our types, returning")
        deviceManager.notifyDevicesTo(AskForNewMovements)
        deviceManager.notifyDevicesTo(SyncContainers)
        deviceManager.notifyDevicesTo(SyncCargos)
        Success(Some(mov))
    }
  }

  /** Completes a Welcome Attendee Order and completes the EXECUTE_ATTENDEE_DEMO movement.
    * Asks the devices to update their movements.
    *
    * @param movement, the ATTENDEE_DEMO_COMPLETED movement
    * @return a Success with the movement if everything goes as planned.
    */
  def finishDemo(movement: Movement)(implicit s: Session, user: AuthenticatedUser): Try[Option[Movement]] = {
    movement.order match {
      case Some(order) =>
        logger.info("Attendee execution completed has order, updating...")
        dataAccess.executeAttendeeDemoForOrder(order.id) match {
          case Some(mov) => movementManager.updateMovement(mov.copy(
            movementStatusId = movementRepository.completedMovementStatus.id,
            inStatusSince = Some(movement.createDateTime)))
          case None => logger.info("Completion movement does not have order, ignoring...")
        }

        orderManager.updateOrder(order.copy(orderStatusId = orderRepository.orderStatusWithCode("COMPLETED").id))
      case None => logger.info("Completion movement does not have order, ignoring...")
    }

    deviceManager.notifyDevicesTo(AskForNewMovements)
    Success(Some(movement))
  }

  /** Logic for the REGISTERED_NEW_ATTENDEE movement.
    *
    * Creates an Welcome Attendee order with an EXECUTE_ATTENDEE_DEMO
    *
    * @param movement, the REGISTERED_NEW_ATTENDEE movement.
    * @return Success with the created movement if successful, Failure with the exception otherwise.
    */
  def processNewAttendeeDemo(movement: Movement)(implicit s: Session , user: AuthenticatedUser): Try[Option[Movement]] = {
    val attendeeOrderType = orderRepository.orderTypeWithCode("WELCOME_ATTENDEE")

    val orderNumber: String = movement.userDefinedField[String]("Name") match {
      case Some(str: String) =>
        logger.info("has user defined field")
        orderRepository.incrementCounterAndReturnNewValueIn(attendeeOrderType)
        str + "_" + attendeeOrderType.counter.getOrElse(0).toString
      case None =>
        logger.info("no user defined field value found")
        ""
    }

    orderManager.createOrder(Order(
      number = orderNumber,
      assignedUserId = Some(user.id),
      orderTypeId = orderRepository.orderTypeWithCode("WELCOME_ATTENDEE").id,
      orderStatusId = orderRepository.orderStatusWithCode("PENDING").id,
      archived = false,
      userDefinedFields = movement.userDefinedFields,
      plannedMovements = Some(List(
        movement.copy(
          movementStatusId = movementRepository.movementStatusWithCode("PENDING").id,
          movementTypeId = movementRepository.movementTypeWithCode("EXECUTE_ATTENDEE_DEMO").id,
          assignedUserId = Some(user.id)
        )
      ))
    ))

    Success(Some(movement))
  }

  /**
    * Logic for handling movements of type TRACKING.
    *
    * @param movement, the movement to analise and create.
    * @return Success with the created movement if successful, Failure with the exception otherwise.
    */
  def processTracking(movement: Movement)(implicit s:Session, currentUser: AuthenticatedUser): Try[Option[Movement]] = {
    val newMovement = movement.copy(
      parentContainerId =
        movement.container.flatMap(_.parentId) orElse movement.cargo.flatMap(_.parentId) orElse movement.parentContainerId
    )

    val updatedContainer: Option[Container] = containerAfterMovement(newMovement) orElse movement.container
    val updatedCargo: Option[Cargo] = cargoAfterMovement(newMovement) orElse movement.cargo

    logger.info(s"Cargo and Container updated: $updatedCargo | $updatedContainer")

    val newItemStatusId: Option[Long] = for { item <- updatedContainer orElse updatedCargo } yield item.itemStatusId
    val movementToInsert = newMovement.copy(newItemStatusId = newItemStatusId orElse movement.newItemStatusId)

    logger.info(s"Movement to insert: $movementToInsert")
    Success(Some(movementToInsert))
  }

  /**
    * Logic for movements of type TRACKING after their creation.
    *
    * A TRACKING movement is created for every container and cargo inside of
    * the main movement's container and their children.
    *
    * If the movement has a Welcome Attendee order and has no ATTENDEE_DEMO_STARTED movement
    * we create one.
    *
    * @param movement, the TRACKING movement that was created.
    * @return Success with the created movement if successful, Failure with the exception otherwise.
    */
  def processTrackingAfterInsert(movement: Movement)(implicit s: Session,
                                                     currentUser: AuthenticatedUser): Try[Option[Movement]] = {

    if(movement.parentMovementId.isEmpty){
      if(movement.orderId.nonEmpty) {
        movement.order match {
          case Some(order) => order.orderType match {
            case Some(ot) if ot.code == "WELCOME_ATTENDEE" =>
              orderManager.updateOrder(
                order.copy(orderStatusId = orderRepository.orderStatusWithCode("IN_PROGRESS").id))
              dataAccess.executeAttendeeDemoForOrder(order.id) match {
                case Some(mov) if dataAccess.startDemoForOrder(order.id).isEmpty =>
                  val now = movement.createDateTime - 1.second
                  movementManager.createMovement(
                    mov.copy(
                      parentMovementId = Some(mov.id),
                      movementTypeId = movementRepository.movementTypeWithCode("ATTENDEE_DEMO_STARTED").id,
                      movementStatusId = movementRepository.movementStatusWithCode("COMPLETED").id,
                      inStatusSince = Some(now),
                      createDateTime = now,
                      endDateTime = Some(now),
                      startDateTime = Some(now)
                    ))
                case _ => logger.info("Order does not have a valid execution movement")
              }

            case _ => logger.info("Order is not of type welcome attendee no processing to be done")
          }
          case None => logger.info("Movement has no order")
        }
      }

      try {
        for {
          container <- movement.container
        } yield {

          container.containersInside.fullDepth.map(containerInside =>
            createMovement(movement.copy(
              parentMovementId = Some(movement.id),
              containerId = Some(containerInside.id),
              parentContainerId = containerInside.parentId
            ))
          )

          container.cargosInside.fullDepth.map(cargoInside =>
            createMovement(movement.copy(
              parentMovementId = Some(movement.id),
              containerId = None,
              cargoId = Some(cargoInside.id),
              parentContainerId = cargoInside.parentId
            ))
          )
        }

        deviceManager.notifyDevicesTo(AskForNewMovements)
        deviceManager.notifyDevicesTo(SyncContainers)
        deviceManager.notifyDevicesTo(SyncCargos)

        Success(Some(movement))

      } catch {
        case ex: Exception =>
          logger.error(s"User: ${currentUser.username}, could not create movement for child items because of exception: $ex")
          Failure(ex)
      }
    }
    else {
      deviceManager.notifyDevicesTo(AskForNewMovements)
      deviceManager.notifyDevicesTo(SyncContainers)
      deviceManager.notifyDevicesTo(SyncCargos)

      Success(Some(movement))
    }
  }

  /** Called to update a container regarding the specified movement.
    *
    * @param movement, the movement with the container that needs to be updated
    * @return the updated container
    */
  private def containerAfterMovement(movement: Movement)(implicit s:Session, currentUser: AuthenticatedUser): Option[Container] = {

    movement.movementType.map(_.code) match {
      case Some("TRACKING") => containerBusinessRules.track(movement.container, movement.createLocation, movement.parentContainer)
      case _ => None
    }
  }

  /** Called to update a cargo regarding the specified movement.
    *
    * @param movement, the movement with the cargo that needs to be updated.
    * @return the updated cargo.
    */
  private def cargoAfterMovement(movement: Movement)(implicit s:Session, currentUser: AuthenticatedUser): Option[Cargo] = {

    movement.movementType.map(_.code) match {
      case Some("TRACKING") => cargoBusinessRules.track(movement.cargo, movement.createLocation, movement.parentContainer)
      case _ => None
    }
  }
}
