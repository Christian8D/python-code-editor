def show_welcome() -> None:
    """Show a quick terminal-style welcome for Unit 2."""
    print(
        r"""
  ________________________________________________
 /                                                \
|   __        __     _                            |
|   \ \      / /__  | | ___ ___  _ __ ___   ___   |
|    \ \ /\ / / _ \ | |/ __/ _ \| '_ ` _ \ / _ \  |
|     \ V  V /  __/ | | (_| (_) | | | | | |  __/  |
|      \_/\_/ \___| |_|\___\___/|_| |_| |_|\___|  |
|                                                 |
|            >>>  TO  UNIT  2  <<<                |
|   ==========================================    |
|   #  Python Code Editor  |  press Run  #        |
|   ==========================================    |
 \________________________________________________/
"""
    )


show_welcome()

age = int(input("Please write your Age: "))


def medicalCondition():
    condition = input(
        '\nDo you have any medical conditions?'
        '\nPlease type "yes" or "no": '
    ).lower().strip()

    if condition != "yes" and condition != "no":
        print("Invalid input. Please enter 'yes' or 'no'.")

    elif age >= 40 and condition == "yes":
        print("Medical clearance required before joining.")

    elif age < 40 or condition == "no":
        print("You can proceed with registration.")

    return condition


if age < 18:

    print("You are eligible for the Teen Fitness Program.")

elif age >= 18 and age <= 40:

    print("You are eligible for the Regular Fitness Program.")

else:
    print("You are eligible for the Senior Wellness Program.")


condition = medicalCondition()

print("\nSelect the membership of your choice:")
print("1. Basic")
print("2. Premium")

membershipType = input(
    "Type '1' for Basic or '2' for Premium: "
).lower().strip()


def personalTraining(membershipType):

    if membershipType == "basic" or membershipType == "1":

        training = input(
            "Do you want to include personal training? (yes/no): "
        ).lower().strip()

        if training == "yes":
            print("Basic plan with personal training: $45 per month.")

        elif training == "no":
            print("Basic plan: $30 per month.")

        else:
            print("Invalid input. Please enter 'yes' or 'no'.")

        return training

    elif membershipType == "premium" or membershipType == "2":
        print("Premium plan: $60 per month.")

    else:
        print("Error. Please select accordingly.")


training = personalTraining(membershipType)


if (membershipType == "premium" or membershipType == "2") and age < 30:
    print("You qualify for a youth discount! 10% off your plan.")

if (membershipType == "basic" or membershipType == "1") and training == "no":
    print("Consider upgrading to Premium for more benefits!")

if (membershipType == "premium" or membershipType == "2") and condition == "yes":
    print("We recommend a free consultation before starting.")
